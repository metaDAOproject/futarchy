test-run:
    (find programs && find tests) | entr -s 'anchor test'
