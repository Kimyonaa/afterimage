# Third-party model attribution

The research pipeline uses the frozen sentence-transformer `sentence-transformers/all-MiniLM-L6-v2`, through the quantized ONNX conversion `Xenova/all-MiniLM-L6-v2`.

- Original model: https://huggingface.co/sentence-transformers/all-MiniLM-L6-v2
- ONNX conversion: https://huggingface.co/Xenova/all-MiniLM-L6-v2
- Model license: Apache License 2.0, https://www.apache.org/licenses/LICENSE-2.0

Base-model binaries are downloaded by the local research pipeline and are not included in the source archive. The archive includes derived fixture embeddings and the small classifier weights trained for this project. Third-party JavaScript dependencies retain their respective licenses; see package manifests and lockfiles.

The three demo records and the generated benchmark records are fictional.

The live Passage Lab and second experiment use the pretrained NLI model through [Xenova/nli-deberta-v3-xsmall](https://huggingface.co/Xenova/nli-deberta-v3-xsmall), derived from [cross-encoder/nli-deberta-v3-xsmall](https://huggingface.co/cross-encoder/nli-deberta-v3-xsmall). Consult those model cards for model provenance and terms. Its downloaded binaries are excluded from the source archive; recorded fixture scores are included. The project does not fine-tune this model.
