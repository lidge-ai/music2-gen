# DAWproject 1.0 test schemas

The upstream source is [bitwig/dawproject](https://github.com/bitwig/dawproject), pinned to commit `ee4dcdde75940f30e14e55401a26955a58b8322b` (2025-07-12). These three files are copied byte-for-byte for test-time schema validation. The upstream project is MIT licensed, © 2020 Bitwig GmbH; the full attribution and terms are in `LICENSE`.

| File | SHA-256 |
| --- | --- |
| `Project.xsd` | `58e2fd9864772850aac3eab1f3de8693857dc5384df6d29fbc320ae1de2347cc` |
| `MetaData.xsd` | `fb3ba378271770dddbcced8990aba537de3d36ff2d58573523460a699221c99f` |
| `LICENSE` | `3aaee5877c9df985f935e40f42f4452182df9e8a8308dcc6cf1a2341458cdfeb` |

To update: choose and review a new upstream commit and its license, copy all three files byte-for-byte, run `shasum -a 256 Project.xsd MetaData.xsd LICENSE`, then update this table, the hash assertions in `src/export/dawproject/xsd-hash.test.ts`, and the decision pin together. Re-run the hosted XSD validation. These fixtures are outside the runtime package.
