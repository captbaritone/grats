# Performance Profiling

If Grats is running slowly in your project, you can share some details about the run with the Grats maintainers to help identify potential performance improvements.

## Timing a Grats Run

Grats is a native binary, so time it like any other command:

```bash
time npx grats
```

## Sharing the Details

When reporting a performance issue:

1.  Time a Grats run with the command above
2.  Open a [GitHub issue](https://github.com/captbaritone/grats/issues/new)
3.  Include the time, the number of TypeScript files in your project, and your operating system
4.  Include the version of Grats you have installed (`npx grats --version`)
5.  If you can, link to a project which reproduces the slow run
