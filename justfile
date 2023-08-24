test:
    (find programs && find tests) | entr -s 'clear && RUST_LOG= anchor test'

bankrun:
    (find programs && find tests) | entr -s 'clear && anchor build && RUST_LOG= yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/autocratV0.ts'

build:
	(find programs) | entr -s 'anchor build'
