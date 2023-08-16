test:
    (find programs && find tests) | entr -s 'anchor test'

auto-build:
	(find programs) | entr -s 'anchor build'
