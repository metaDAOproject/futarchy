test:
    (find programs && find tests) | entr -s 'clear && RUST_LOG= anchor test'

# build-verifiable autocrat_v0
build-verifiable PROGRAM_NAME:
	solana-verify build --library-name {{ PROGRAM_NAME }} -b ellipsislabs/solana:1.16.10

deploy PROGRAM_NAME CLUSTER:
	solana program deploy -u {{ CLUSTER }} --program-id ./target/deploy/{{ PROGRAM_NAME }}-keypair.json ./target/deploy/{{ PROGRAM_NAME }}.so --final

upgrade PROGRAM_NAME PROGRAM_ID CLUSTER:
	anchor upgrade ./target/deploy/{{ PROGRAM_NAME }}.so -p {{ PROGRAM_ID }} --provider.cluster {{ CLUSTER }}

upgrade-idl PROGRAM_NAME PROGRAM_ID CLUSTER:
	anchor idl upgrade --filepath ./target/idl/{{ PROGRAM_NAME }}.json {{ PROGRAM_ID }} --provider.cluster {{ CLUSTER }}
	

bankrun:
    (find programs && find tests) | entr -csr 'anchor build -p autocrat_v0 && RUST_LOG= yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/autocratV0.ts'

bankrun-vault:
    (find programs && find tests) | entr -csr 'anchor build -p conditional_vault && RUST_LOG= yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/conditionalVault.ts'

bankrun-migrator:
    (find programs && find tests) | entr -csr 'anchor build -p autocrat_migrator && yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/migrator.ts'

bankrun-vault-logs:
    (find programs && find tests) | entr -csr 'anchor build -p conditional_vault && yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/conditionalVault.ts'

bankrun-logs:
    (find programs && find tests) | entr -csr 'anchor build -p autocrat_v0 && yarn run ts-mocha -p ./tsconfig.json -t 1000000 tests/autocratV0.ts'

build:
	(find programs) | entr -s 'anchor build'
