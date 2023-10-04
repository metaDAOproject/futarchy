test:
    (find programs && find tests) | entr -s 'clear && RUST_LOG= anchor test'

build-verifiable:
	solana-verify build --library-name conditional_vault -b ellipsislabs/solana:1.14.20 --bpf

bankrun:
    (find programs && find tests) | entr -csr 'anchor build -p autocrat_v0 && RUST_LOG= yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/autocratV0.ts'

bankrun-vault:
    (find programs && find tests) | entr -csr 'anchor build -p conditional_vault && RUST_LOG= yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/conditionalVault.ts'

bankrun-with-logs:
    (find programs && find tests) | entr -csr 'anchor build -p autocrat_v0 && yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/autocratV0.ts'

build:
	(find programs) | entr -s 'anchor build'
