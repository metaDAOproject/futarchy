test:
    (find programs && find tests) | entr -s 'RUST_LOG= anchor test'

build:
	(find programs) | entr -s 'anchor build'
