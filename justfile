test:
    (find programs && find tests) | entr -s 'RUST_LOG= yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/conditionalVault.*'

auto-build:
	(find programs) | entr -s 'anchor build'
