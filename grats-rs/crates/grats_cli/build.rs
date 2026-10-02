//! Sets `GRATS_VERSION`, which `grats --version` prints, to the version in
//! the repository's `package.json`, unless it's already set.

use std::fs;
use std::path::Path;

fn main() {
    println!("cargo::rerun-if-env-changed=GRATS_VERSION");
    if std::env::var("GRATS_VERSION").is_ok() {
        return;
    }
    let package_json = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../../package.json");
    println!("cargo::rerun-if-changed={}", package_json.display());
    let text = fs::read_to_string(&package_json).expect("Expected to read package.json");
    let package: serde_json::Value =
        serde_json::from_str(&text).expect("Expected package.json to be JSON");
    let version = package["version"]
        .as_str()
        .expect("Expected package.json to have a version");
    println!("cargo::rustc-env=GRATS_VERSION={version}");
}
