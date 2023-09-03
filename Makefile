.PHONY: install-git-hooks install lint lint-check format format-check build all clean clean-all

install-git-hooks: 
	npm run install:git:hooks

install: install-git-hooks
	npm i

lint:
	npm run lint

lint-check: 
	npm run lint:check

format:
	npm run format

format-check:
	npm run format:check

build:
	npm run build

all: format lint build

clean:
	rm -rf /dist

clean-all:
	rm -rf dist/ && rm -rf node_modules/
