# Developer component reference

The customer-facing UI deliberately hides implementation details.

## Simple mode
- Model: ggml-org/Qwen3-0.6B-GGUF
- File upstream: Qwen3-0.6B-Q4_0.gguf
- Approx size: 429 MB
- SHA-256: da2572f16c06133561ce56accaa822216f2391ef4d37fba427801cd6736417d4
- Download policy: Wi-Fi only

## Detailed mode
- Model: ggml-org/Qwen3-1.7B-GGUF
- File upstream: Qwen3-1.7B-Q4_K_M.gguf
- Approx size: 1.28 GB
- SHA-256: d2387ca2dbfee2ffabce7120d3770dadca0b293052bc2f0e138fdc940d9bc7b5
- Download policy: Wi-Fi only, on demand

## Knowledge pack
The packaged `knowledge/knowledge.json` is a first-party app component. Every launch compares its SHA-256 to the installed working copy. An app update containing a changed pack therefore refreshes it automatically without an external search API or backend.
