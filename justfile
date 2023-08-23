test:
    (find programs && find tests) | entr -s 'anchor test'

build:
	(find programs) | entr -s 'anchor build'
