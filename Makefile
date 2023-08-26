.PHONY: install-git-hooks install lint lint-check format format-check build-pre build-main build-all all clean clean-all

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

build-pre: 
	npm run build:pre

build-main:
	npm run build:main

build-all: 
	npm run build:all

all: install build-all

clean:
	rm -rf /dist

clean-all:
	rm -rf dist/ && rm -rf node_modules/