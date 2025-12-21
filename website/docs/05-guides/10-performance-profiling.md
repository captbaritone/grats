# Performance Profiling

If Grats is running slowly in your project, you can capture a CPU performance profile and share it with the Grats maintainers to help identify potential performance improvements.

## Capturing a Performance Profile

Node.js has built-in support for CPU profiling via the `--cpu-prof` flag. To capture a profile of a Grats run:

```bash
node --cpu-prof --cpu-prof-name=grats-profile.cpuprofile ./node_modules/grats/dist/src/cli.js
```

This will:

1. Run Grats on your project
2. Write a CPU profile to `grats-profile.cpuprofile` in your current directory

## Viewing the Profile

1. Open Chrome and navigate to `chrome://inspect`
2. Click "Open dedicated DevTools for Node"
3. Go to the **Performance** tab
4. Click **Load profile** and select your `.cpuprofile` file

## Sharing the Profile

When reporting a performance issue:

1. Run the profiling command above
2. Open a [GitHub issue](https://github.com/captbaritone/grats/issues/new)
3. Attach the `.cpuprofile` file to the issue
4. Include the version of Grats you have installed
