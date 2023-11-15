# Run Instructions for meta-dao

## Introduction

This document provides detailed run instructions for building the program and running tests (at least). It includes steps to set up the environment and handle common issues and gotchas.

## Prerequisites

- Rust (version rustc 1.73.0)
- Solana (version 1.16.18)
- Node.js (latest stable version)
- Yarn (latest stable version)
- Anchor (follow instructions from the Anchor documentation)

## Environment Setup

### Rust Installation

1. Download and install `rustup` by running:
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```
2. Follow the on-screen instructions to complete the installation.
3. After installation, install the specific Rust version (rustc 1.73.0):
   ```bash
   rustup install 1.73.0
   rustup default 1.73.0
   ```

### Solana Installation

1. Install Solana using the `solana-install` tool:
   <pre><code>sh -c "$(curl -sSfL https://release.solana.com/v1.16.18/install)"</code></pre>
2. Add Solana to your PATH following the instructions provided at the end of the installation process.

### Node.js and Yarn Installation

1. Install Node.js from [Node.js official website](https://nodejs.org/) or use a version manager like `nvm`.
2. Install Yarn globally using npm:
   <pre><code>npm install -g yarn</code></pre>

### Anchor Installation

1. Follow the detailed installation instructions for Anchor provided in the <a href="https://www.anchor-lang.com/docs/installation" target="_blank">Anchor documentation</a>.

## Installation Steps

After setting up the environment and installing all prerequisites, run the following commands in your project directory:

1. Build the project using Anchor:
   <pre><code>anchor build</code></pre>
2. Run tests with Anchor:
   <pre><code>anchor test</code></pre>

## Common Issues and Troubleshooting

- If you encounter any issues with version mismatches, ensure that the installed versions match the required versions listed in the prerequisites.
- For any errors related to dependencies, try running `yarn install` in the project directory to ensure all necessary packages are installed.

## Gotchas

- You have the latest rustc version istalled but `anchor build` still complains that you have an old rust version installed... something like this (below). This means you need to update your solana version as documented above.

```
error: package regex-automata v0.4.3 cannot be built because it requires rustc 1.65 or newer, while the currently active rustc version is 1.62.0-dev
```
