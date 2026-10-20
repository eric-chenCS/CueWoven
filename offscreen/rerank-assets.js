// Published model data only; no remote code or hosted inference.
export const RERANK_MODEL = "cross-encoder/ettin-reranker-32m-v1";
export const RERANK_REVISION = "b33e5ceb5110773ea9cf5e00c9bedc83a8c2afdd";
export const RERANK_ASSETS = Object.freeze({
  "2_Dense/model.safetensors": {
    "bytes": 589912,
    "sha256": "ae4d8431b8ed8afeda16dd51608c4cb7e0f810724a91423dbbb867c047285000"
  },
  "3_LayerNorm/model.safetensors": {
    "bytes": 3224,
    "sha256": "3e8b5ae0d2716b538d0cdd8664bef438f20a09a1b79654fc09f19560197d3274"
  },
  "4_Dense/model.safetensors": {
    "bytes": 1684,
    "sha256": "03aa39279659756a52fb02cd569b97f2d1fb0d8036ab74d45c4736f358389e01"
  },
  "config.json": {
    "bytes": 1730,
    "sha256": "a851a8c90dda8258ab60841d26cd68b69ce2e7950cf26cf7e61c8d30f9487cb9"
  },
  "onnx/model_quint8_avx2.onnx": {
    "bytes": 32416083,
    "sha256": "7ca231b98dc591122774127865a293aae90b9a2ccb148afe8c2587d03703f8d0"
  },
  "tokenizer.json": {
    "bytes": 3583327,
    "sha256": "28c5e078e4c52aa37cf0e6de1a212878f3dbd58dd1c70466298efe0b6b86db35"
  },
  "tokenizer_config.json": {
    "bytes": 488,
    "sha256": "2b85302525d8c528a9e1fbaea2733472bd00d4755eae881441c8c52b90e2d600"
  }
});
