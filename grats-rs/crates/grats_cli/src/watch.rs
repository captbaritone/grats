//! Watch mode: Grats rebuilds when what the last build read has changed.
//!
//! Each question a build asks the host about the file system is recorded
//! with its answer. The directories those questions are about are watched,
//! and when something in them changes, the questions it may affect are asked
//! again. If an answer differs, Grats rebuilds. That covers the files of the
//! program, the `tsconfig.json` and the configs it extends, the directories
//! `include` walks, where new files appear, and the paths modules failed to
//! resolve to, without knowing which is which.
//!
//! The files Grats writes are asked about again once they're written, so
//! writing the schema doesn't cause a rebuild. Neither does changing a file
//! the build didn't read, or saving a file without changing it.

use std::collections::hash_map::DefaultHasher;
use std::collections::{BTreeSet, HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::process::ExitCode;
use std::sync::mpsc::{self, Receiver, RecvTimeoutError};
use std::sync::{Arc, Mutex, MutexGuard};
use std::time::Duration;

use grats::cli::{WatchMode, WatchRequest};
use grats::host::{DirEntries, FileKind, Host};
use grats::utils::path;
use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};

use crate::native_host::{NativeHost, from_grats_path, to_grats_path};

/// How long the file system must be quiet before Grats rebuilds, so that
/// changes made together, like switching branches, cause one rebuild.
const DEBOUNCE: Duration = Duration::from_millis(100);

pub fn run(request: WatchRequest) -> ExitCode {
    let host = Arc::new(RecordingHost::new());
    let Some(watch_mode) = WatchMode::start(request, Arc::clone(&host) as Arc<dyn Host>) else {
        return ExitCode::FAILURE;
    };
    let (sender, receiver) = mpsc::channel();
    let mut watcher = match notify::recommended_watcher(sender) {
        Ok(watcher) => watcher,
        Err(error) => {
            host.log_error(&format!("Grats: Could not watch the files: {error}"));
            return ExitCode::FAILURE;
        }
    };
    let mut watched = Watched::default();
    loop {
        host.clear();
        if watch_mode.rebuild() && host.wrote_changes() {
            // The fixes changed the files.
            watch_mode.report_change();
            continue;
        }
        loop {
            watched.update(&mut watcher, &host);
            let changes = wait_for_changes(&receiver, &watched, &host);
            if host.changed(&changes) {
                break;
            }
        }
        watch_mode.report_change();
    }
}

/// A question about the file system, by the `Host` method which answers it.
#[derive(PartialEq, Eq, Hash)]
enum Question {
    ReadFile(String),
    Stat(String, bool),
    ReadLink(String),
    Realpath(String),
    ReadDir(String),
}

impl Question {
    fn path(&self) -> &str {
        match self {
            Question::ReadFile(path)
            | Question::Stat(path, _)
            | Question::ReadLink(path)
            | Question::Realpath(path)
            | Question::ReadDir(path) => path,
        }
    }

    /// Asks `host`, and returns a hash of the answer.
    fn ask(&self, host: &NativeHost) -> u64 {
        match self {
            Question::ReadFile(path) => hash(&host.read_file(path)),
            Question::Stat(path, follow_links) => hash(&host.stat(path, *follow_links)),
            Question::ReadLink(path) => hash(&host.read_link(path)),
            Question::Realpath(path) => hash(&host.realpath(path)),
            Question::ReadDir(path) => hash(&host.read_dir(path).as_ref().map(dir_entries)),
        }
    }
}

fn hash(answer: &impl Hash) -> u64 {
    let mut hasher = DefaultHasher::new();
    answer.hash(&mut hasher);
    hasher.finish()
}

fn dir_entries(entries: &DirEntries) -> (&[String], &[String]) {
    (&entries.files, &entries.directories)
}

/// A `NativeHost` which records the questions asked of it since it was last
/// cleared, with a hash of each answer.
struct RecordingHost {
    inner: NativeHost,
    state: Mutex<State>,
}

#[derive(Default)]
struct State {
    answers: HashMap<Question, u64>,
    /// Whether a write has changed a file.
    wrote_changes: bool,
}

impl RecordingHost {
    fn new() -> Self {
        RecordingHost {
            inner: NativeHost,
            state: Mutex::default(),
        }
    }

    fn state(&self) -> MutexGuard<'_, State> {
        self.state
            .lock()
            .expect("Expected no panic while recording")
    }

    fn record<T: Hash>(&self, question: Question, answer: T) -> T {
        self.state().answers.insert(question, hash(&answer));
        answer
    }

    fn clear(&self) {
        *self.state() = State::default();
    }

    fn wrote_changes(&self) -> bool {
        self.state().wrote_changes
    }

    /// Whether the answer to a question has changed.
    fn changed(&self, changes: &Changes) -> bool {
        self.state().answers.iter().any(|(question, answer)| {
            changes.affect(question) && question.ask(&self.inner) != *answer
        })
    }

    /// The directories to watch: those of the questions' paths, and the
    /// directories whose entries were read. A directory which doesn't exist
    /// is watched through the closest one above it which does.
    fn directories(&self) -> BTreeSet<String> {
        let state = self.state();
        let mut directories = HashSet::new();
        for question in state.answers.keys() {
            let path = question.path();
            directories.insert(path::dirname(path));
            if let Question::ReadDir(_) = question {
                directories.insert(path);
            }
        }
        directories
            .into_iter()
            .map(|directory| {
                let mut directory = directory;
                while self.inner.stat(directory, true) != Some(FileKind::Directory) {
                    let parent = path::dirname(directory);
                    if parent == directory {
                        break;
                    }
                    directory = parent;
                }
                directory.to_string()
            })
            .collect()
    }
}

impl Host for RecordingHost {
    fn read_file(&self, path: &str) -> Option<String> {
        let answer = self.inner.read_file(path);
        self.record(Question::ReadFile(path.to_string()), answer)
    }

    fn stat(&self, path: &str, follow_links: bool) -> Option<FileKind> {
        let answer = self.inner.stat(path, follow_links);
        self.record(Question::Stat(path.to_string(), follow_links), answer)
    }

    fn read_link(&self, path: &str) -> Option<String> {
        let answer = self.inner.read_link(path);
        self.record(Question::ReadLink(path.to_string()), answer)
    }

    fn realpath(&self, path: &str) -> Option<String> {
        let answer = self.inner.realpath(path);
        self.record(Question::Realpath(path.to_string()), answer)
    }

    fn read_dir(&self, path: &str) -> Option<DirEntries> {
        let answer = self.inner.read_dir(path);
        self.record(
            Question::ReadDir(path.to_string()),
            answer.as_ref().map(dir_entries),
        );
        answer
    }

    fn current_directory(&self) -> String {
        self.inner.current_directory()
    }

    fn write_file(&self, path: &str, contents: &str) -> Result<(), String> {
        let changed = self.inner.read_file(path).as_deref() != Some(contents);
        self.inner.write_file(path, contents)?;
        let mut state = self.state();
        state.wrote_changes |= changed;
        // Grats' own writes don't cause a rebuild.
        let changes = Changes::of([path.to_string()]);
        for (question, answer) in &mut state.answers {
            if changes.affect(question) {
                *answer = question.ask(&self.inner);
            }
        }
        Ok(())
    }

    fn log(&self, message: &str) {
        self.inner.log(message);
    }

    fn log_error(&self, message: &str) {
        self.inner.log_error(message);
    }
}

/// What has changed on the file system.
enum Changes {
    /// Anything may have changed.
    Everything,
    /// The entries at these paths were created, changed or removed.
    Paths {
        paths: HashSet<String>,
        /// The directories of `paths`, whose entries may have changed.
        parents: HashSet<String>,
    },
}

impl Changes {
    fn of(paths: impl IntoIterator<Item = String>) -> Self {
        let paths: HashSet<String> = paths.into_iter().collect();
        let parents = paths
            .iter()
            .map(|path| path::dirname(path).to_string())
            .collect();
        Changes::Paths { paths, parents }
    }

    /// Whether the answer to `question` may have changed.
    fn affect(&self, question: &Question) -> bool {
        let Changes::Paths { paths, parents } = self else {
            return true;
        };
        let mut path = question.path();
        if let Question::ReadDir(_) = question
            && parents.contains(path)
        {
            return true;
        }
        // The entry, or a directory it's in, which may have been renamed or
        // replaced.
        loop {
            if paths.contains(path) {
                return true;
            }
            let parent = path::dirname(path);
            if parent == path {
                return false;
            }
            path = parent;
        }
    }
}

/// The directories being watched.
#[derive(Default)]
struct Watched {
    directories: BTreeSet<String>,
    /// The watched directories by their real paths, which events may name
    /// instead.
    by_real_path: HashMap<String, Vec<String>>,
}

impl Watched {
    /// Watches the directories of the questions asked of `host`, and stops
    /// watching the rest.
    fn update(&mut self, watcher: &mut RecommendedWatcher, host: &RecordingHost) {
        let directories = host.directories();
        if directories == self.directories {
            return;
        }
        let mut paths = watcher.paths_mut();
        for directory in self.directories.difference(&directories) {
            // It may have been removed, and stopped being watched already.
            let _ = paths.remove(&from_grats_path(directory));
        }
        for directory in directories.difference(&self.directories) {
            if let Err(error) = paths.add(&from_grats_path(directory), RecursiveMode::NonRecursive)
            {
                host.log_error(&format!(
                    "Grats: Could not watch `{}`: {error}",
                    path::to_native(directory)
                ));
            }
        }
        if let Err(error) = paths.commit() {
            host.log_error(&format!("Grats: Could not watch the files: {error}"));
        }
        self.by_real_path.clear();
        for directory in &directories {
            let real_path = host
                .inner
                .realpath(directory)
                .unwrap_or_else(|| directory.clone());
            self.by_real_path
                .entry(real_path)
                .or_default()
                .push(directory.clone());
        }
        self.directories = directories;
    }

    /// The paths an event's path may stand for: itself, and the same entry
    /// in each watched directory it's really in.
    fn paths(&self, native: &Path) -> Vec<String> {
        let event_path = to_grats_path(native);
        let mut paths = Vec::new();
        let parent = path::dirname(&event_path);
        let name = event_path.rsplit('/').next().unwrap_or_default();
        for directory in self.by_real_path.get(parent).into_iter().flatten() {
            paths.push(path::resolve(directory, name));
        }
        paths.extend(
            self.by_real_path
                .get(&event_path)
                .into_iter()
                .flatten()
                .cloned(),
        );
        paths.push(event_path);
        paths
    }
}

/// Waits for a change, and then until the file system has been quiet for
/// `DEBOUNCE`, and returns every change.
fn wait_for_changes(
    receiver: &Receiver<notify::Result<Event>>,
    watched: &Watched,
    host: &RecordingHost,
) -> Changes {
    let mut paths = Vec::new();
    let mut everything = false;
    let mut changed = false;
    loop {
        let result = if changed {
            match receiver.recv_timeout(DEBOUNCE) {
                Ok(result) => result,
                Err(RecvTimeoutError::Timeout) => break,
                Err(RecvTimeoutError::Disconnected) => {
                    panic!("Expected the watcher to outlive this")
                }
            }
        } else {
            receiver
                .recv()
                .expect("Expected the watcher to outlive this")
        };
        match result {
            // Including Grats' own reads.
            Ok(event) if matches!(event.kind, EventKind::Access(_)) => continue,
            Ok(event) if event.need_rescan() => everything = true,
            Ok(event) => {
                for native in &event.paths {
                    paths.extend(watched.paths(native));
                }
            }
            Err(error) => {
                host.log_error(&format!("Grats: Error watching the files: {error}"));
                everything = true;
            }
        }
        changed = true;
    }
    if everything {
        Changes::Everything
    } else {
        Changes::of(paths)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn changes_affect_questions_about_their_entries() {
        let changes = Changes::of(["/project/src/a.ts".to_string(), "/project/lib".to_string()]);
        let affect = |question| changes.affect(&question);
        assert!(affect(Question::ReadFile("/project/src/a.ts".to_string())));
        assert!(!affect(Question::ReadFile("/project/src/b.ts".to_string())));
        // An entry in a directory which changed.
        assert!(affect(Question::Realpath("/project/lib/c.ts".to_string())));
        // The entries of the directory of an entry which changed.
        assert!(affect(Question::ReadDir("/project/src".to_string())));
        assert!(affect(Question::ReadDir("/project".to_string())));
        assert!(!affect(Question::Stat("/project/src".to_string(), true)));
        assert!(!affect(Question::ReadDir("/".to_string())));
        assert!(Changes::Everything.affect(&Question::ReadLink("/elsewhere".to_string())));
    }
}
