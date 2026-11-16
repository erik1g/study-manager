# Changelog

## [0.2.0](https://github.com/erik1g/study-manager/compare/v0.1.0...v0.2.0) (2026-11-16)


### ⚠ BREAKING CHANGES

* **i18n:** The mail subjects (GOTRUE_MAILER_SUBJECTS_*) in docker-compose.yml are now templates that pick the recipient's language. update.sh does not replace the compose file: take over the new GOTRUE_MAILER_SUBJECTS_* lines from docker-compose.yml of this release, otherwise subjects stay German while the mail text follows the language.

### Neu

* **course:** courses have a language for what is written into them ([#36](https://github.com/erik1g/study-manager/issues/36)) ([0a1c91e](https://github.com/erik1g/study-manager/commit/0a1c91eebfc25ce8c0838db4648170d33997b826))
* **i18n:** English and German interface, chosen per user ([#35](https://github.com/erik1g/study-manager/issues/35)) ([9ac5660](https://github.com/erik1g/study-manager/commit/9ac56600fffad54626d45a8b437fc51fced05342))
* **mcp:** English instructions and tools, with the user's and courses' languages ([#37](https://github.com/erik1g/study-manager/issues/37)) ([c4f7b73](https://github.com/erik1g/study-manager/commit/c4f7b7337ffd63b1d47a9141d1c9d89fa5aaf364))
* **search:** match words alike in every language ([#38](https://github.com/erik1g/study-manager/issues/38)) ([37da159](https://github.com/erik1g/study-manager/commit/37da1592d506106b87d46dde8526b1b5314677e6))


### Behoben

* **i18n:** greeting, "until" and free disk space were always German ([#39](https://github.com/erik1g/study-manager/issues/39)) ([73154de](https://github.com/erik1g/study-manager/commit/73154def8f099d42a59ad96a5b56e27f34f6783a))

## 0.1.0 (2026-11-10)


### Neu

* **admin:** update.sh and the operator bundle ([fa863c2](https://github.com/erik1g/study-manager/commit/fa863c2d170017a9757ad8a72d9261294813c45b))
* first public version of the Study Manager ([1a14178](https://github.com/erik1g/study-manager/commit/1a14178472cd08de85c577c2f908d2bdfef3a944))


### Behoben

* **ci:** leave the Playwright package out of the general test run ([87f5306](https://github.com/erik1g/study-manager/commit/87f5306db49a65b6325eed55e8e6330a798ea247))
* **ci:** prepare the test database's search path; start releases at 0.1.0 ([2028c96](https://github.com/erik1g/study-manager/commit/2028c967cdc23c9c84ac87da00e4c98710f5db9b))
* **ci:** write .env.test as the current user so the runner can read it ([855f95f](https://github.com/erik1g/study-manager/commit/855f95f5eddfc4557578f854fa4172724e6fdd07))
* **docs:** generate the props table before the type check ([04d2b6c](https://github.com/erik1g/study-manager/commit/04d2b6cddbf53908712fcac7717504dbf771e97d))
* **server:** make the backup work on a new installation ([65d7611](https://github.com/erik1g/study-manager/commit/65d7611230f5d3886fb76f41656389c7c0eda1e6))


### Dokumentation

* collect the instructions for Claude and developers in .claude/ ([#13](https://github.com/erik1g/study-manager/issues/13)) ([50e3f5e](https://github.com/erik1g/study-manager/commit/50e3f5ec237a475ea820bc1f68d7c8e049c046c3))
* fix the README links to the documentation (no trailing slash) ([#12](https://github.com/erik1g/study-manager/issues/12)) ([13f7d13](https://github.com/erik1g/study-manager/commit/13f7d138fb350fe24ae8e99308083411345111b3))
