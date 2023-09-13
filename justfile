test:
    (find programs && find tests) | entr -s 'clear && RUST_LOG= anchor test'

bankrun:
    (find programs && find tests) | entr -csr 'anchor build -p autocrat_v0 && RUST_LOG= yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/autocratV0.ts'

bankrun-with-logs:
    (find programs && find tests) | entr -csr 'anchor build -p autocrat_v0 && yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/autocratV0.ts'

build:
	(find programs) | entr -s 'anchor build'
