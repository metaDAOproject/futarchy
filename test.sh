#!/bin/sh

(find programs && find tests) | entr -csr 'anchor build -p autocrat_v0 && RUST_LOG= anchor test --skip-build'