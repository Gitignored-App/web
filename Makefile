.PHONY: build all
MAKEFLAGS += --silent

outdir=temp-dev/temp-two

all:
	make lint &&\
		make check &&\
		make format-check &&\
		make test-dev &&\
		make build

code-gen:
	node script/code-gen.js && make format

pre-dev:
	cp .env.development .env && make code-gen

pre-prod:
	cp .env.production .env && make code-gen

# cli-executable
default: pre-dev
	cargo run

help: pre-dev
	cargo run -- --help

version: pre-dev
	cargo run -- --version

show: pre-dev
	cargo run -- template --show

show-column: pre-dev
	cargo run -- template --show --column $(c)

preview: pre-dev
	cargo run -- template --preview rust node java vscode jetbrain

search: pre-dev
	cargo run -- template --search rust node java vscode jetbrain whatever

generate: pre-dev
	cargo run -- template --generate rust node java vscode jetbrain whatever ${arg}

force-generate: pre-dev
	make generate arg=-f

generate-outdir: pre-dev
	rm -rf ${outdir} && cargo run -- template --generate rust node java vscode jetbrain whatever -o ${outdir}

append: pre-dev
	cargo run -- template --append rust node java vscode jetbrain whatever

append-absent-outdir: pre-dev
	rm -rf ${outdir} && cargo run -- template --append rust node java vscode jetbrain whatever -o ${outdir}

append-existing-outdir: pre-dev
	cargo run -- template --append rust node java vscode jetbrain whatever -o ${outdir}

update: pre-dev
	cargo run -- template --update

# non cli-executable
check:
	cargo check

build: pre-prod
	rm -rf target/release && cargo build --release

pre-test:
	rm -rf temp-test

test:
	cargo test --no-fail-fast

test-dev: pre-dev pre-test test

test-prod: pre-prod pre-test test

format:
	cargo fmt

format-check:
	cargo fmt --check

lint:
	cargo clippy --all-targets --all-features -- -D warnings

clean:
	rm -rf target

install-rust:
	curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs -y | sh
	
install-node-packages:
	cd script && pnpm install --frozen-lockfile

pre-publish:
	node script/publish pre-publish

post-publish:
	node script/publish post-publish

publish: pre-publish
	cargo publish $(argv) && make post-publish

package: pre-publish
	cargo package $(argv) && make post-publish
