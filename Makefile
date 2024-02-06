postinstall:
	cd apps/cli && make install-rust

lint:
	pnpm --stream -r lint

typecheck:
	pnpm --stream -r typecheck

format-write:
	pnpm --stream -r format-write

format-check:
	pnpm --stream -r format-check

generate-type-for-ci:
	pnpm --stream -r generate-type-for-ci

pretest:
	cd apps/web && make build-testing

test:
	make pretest && pnpm --stream -r test

test-cli:
	pnpm --stream -r test --filter=cli

test-web:
	pnpm --stream -r test --filter=web

deploy-web:
	cd apps/web && make pre-deploy-production && cd ../../ && vercel --prod 
