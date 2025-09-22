# homebrew-kp

This repository hosts the Homebrew tap for the `kp` CLI.

## Setup

1. Update `Formula/kp.rb` whenever you cut a new `kp` release. The URLs already point at `aboutmydreams/kp`.
2. After publishing a GitHub release (for example `v0.1.0`), update the `sha256` in the formula. Compute it with:
   ```bash
   curl -L -o kp.tar.gz https://github.com/aboutmydreams/kp/archive/refs/tags/v0.1.0.tar.gz
   shasum -a 256 kp.tar.gz
   ```
3. Commit the changes and push to the GitHub repository `aboutmydreams/homebrew-kp`:
   ```bash
   git init
   git add .
   git commit -m "Add kp formula"
   git remote add origin git@github.com:aboutmydreams/homebrew-kp.git
   git push -u origin main
   ```

## Using the tap

Once the repository is public, users install the CLI via:

```bash
brew tap aboutmydreams/kp
brew install kp
```

Remember to bump the formula each time you release a new version of `kp`.
