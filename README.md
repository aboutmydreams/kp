# kp

`kp` is a tiny cross-platform CLI that finds the process bound to a TCP port and sends it a signal. Install it globally via npm or Homebrew and terminate a port hog with a single command.

## Install

```bash
# npm (global)
npm install -g kp-cli

# Homebrew
brew tap aboutmydreams/kp
brew install kp
```

> The npm package name is `kp-cli`. Once you secure the unscoped `kp` name on npm you can rename the package and update these commands.

## Usage

```bash
kp <port> [options]
```

| Option | Description |
| --- | --- |
| `-f`, `--force` | Send `SIGKILL` instead of `SIGTERM` |
| `--signal=<name>` | Send an explicit signal (overrides `--force`) |
| `-h`, `--help` | Show the inline help |

Examples:

```bash
kp 5173             # send SIGTERM (default) to any PID on TCP port 5173
kp 8080 --force     # force kill
kp 3000 --signal=SIGINT
```

When no processes are bound to the port you will see `No process found listening on TCP port <port>.`

## Requirements

- Node.js 14 or newer (used for the CLI runtime)
- One of `lsof`, `fuser`, `ss`, or `netstat` must be available on the host (macOS and most Linux distributions ship with at least one of these)

## Local development

```bash
npm install
npm link  # exposes `kp` in your PATH while developing
```

You can test the CLI directly:

```bash
kp 3000
kp 8080 --force
kp 5000 --signal=SIGINT
```

## Release workflow (npm + Homebrew)

1. Update `package.json` with the new version (`npm version <patch|minor|major>`).
2. Commit the changes and tag the release: `git commit -am "Release vX.Y.Z" && git tag vX.Y.Z`.
3. Publish to npm: `npm publish --access public`.
4. Push the branch and tag: `git push origin main --tags`.
5. Create a GitHub release from tag `vX.Y.Z` and attach the source tarball (or rely on the auto-generated archive).
6. In `homebrew-kp/Formula/kp.rb`, update `url` if the version changed and replace `sha256` with the checksum of the new archive:
   ```bash
   curl -L -o kp.tar.gz https://github.com/aboutmydreams/kp/archive/refs/tags/vX.Y.Z.tar.gz
   shasum -a 256 kp.tar.gz
   ```
7. Commit and push the updated formula to `aboutmydreams/homebrew-kp`, then tag it if desired.

Once these steps are complete, users can upgrade via either npm or Homebrew.

## License

MIT
