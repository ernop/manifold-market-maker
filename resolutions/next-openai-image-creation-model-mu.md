---
market: yXhdIksmh4epK3PvuEgu
recommendation: ANSWERS
confidence: medium
checked: 2026-09-29
summary: ANSWERS: 30-word quote answer NO; 2025 benchmarks and launch tests show GPT-4o/gpt-image-1 often slipped letters in long text, well short of 80%.
---
# Next OpenAI image creation model multimarket

## Finding

The model being judged is GPT-4o image generation, launched in ChatGPT for paying users on 2025-03-25 and released in the API as gpt-image-1 on 2025-04-23, which OpenAI describes as the same model; Ernie extended the close to 2025-05-01 so API tests could run. No 2025 source measures exactly "30-word quote, letter-perfect, 8 times in 10", but every source that examines long text finds regular small errors. OneIG-Bench, the only benchmark that reports the share of images with completely correct text, tested the 2025-04-29 GPT-4o version and found 15% for prompts under 30 words and 17% for 30-60 words, though it counts capitalization changes as errors. LongText-Bench ignores case, punctuation, and word order, and it still found gpt-image-1 missed 4.4% of words in 10-50-word passages, about 1.3 missed words per 30-word quote on average. Hands-on tests at launch, including Ars Technica's poem, the April 2025 empirical study's own showcase examples, and user reports, all show typos or doubled letters in long passages. Together this points to well under 80% letter-perfect, so NO.

## Answers

| Answer ID | Verdict | Confidence | Answer | Reason |
|---|---|---|---|---|
| b1d63aeffb05 | NO | medium | Long quotes of 30 words, if asked to be included as text in the image, come out letter-correctly at least 80% of the time. (i.e. the english is correct) | [OneIG-Bench](https://arxiv.org/html/2506.07977v3) found GPT-4o's text completely correct in only 15-17% of images at these lengths, and [LongText-Bench](https://arxiv.org/html/2507.22058)'s lenient score still implies about 1.3 missed words per 30-word passage; launch tests show recurring typos. |

## Evidence

- [Introducing 4o Image Generation (OpenAI)](https://openai.com/index/introducing-4o-image-generation/) (2025-03-25; direct fetch blocked by Cloudflare, limitations text read via [a mirror](https://kosugi21.net/article/introducing-4o-image-generation)): OpenAI says requests to fix "typos are not always effective" and "may also ... introduce more errors", that the model can crop long images such as posters "too tightly, especially near the bottom", and that it struggles to render detail "at a very small size".
- [Introducing our latest image generation model in the API (OpenAI)](https://openai.com/index/image-generation-api/) (2025-04-23): gpt-image-1 is "the natively multimodal model that powers this experience in ChatGPT", now in the API.
- [OneIG-Bench (arXiv 2506.07977, NeurIPS 2025)](https://arxiv.org/html/2506.07977v3) (2025-06): in the Text Rendering table, GPT-4o (version dated 2025-04-29) has a completion rate, meaning the share of images whose text is completely correct, of 0.150 for prompts under 30 words, 0.171 for 30-60 words, and 0.070 above 60 words. Text is read by Qwen2.5-VL-7B. Capitalization mismatches count as errors, which the authors say lowers GPT-4o's score.
- [X-Omni paper introducing LongText-Bench (arXiv 2507.22058)](https://arxiv.org/html/2507.22058) (2025-07-29) and [its scoring code](https://github.com/X-Omni-Team/X-Omni/blob/main/textbench/summary_scores.py) (accessed 2026-09-29): GPT-4o scores 0.956 on English prompts whose text runs 10-30 words (short set) or 30-50 words (long set), 4 images per prompt. The score is the share of target words found after lowercasing, stripping punctuation, and ignoring word order.
- [STRICT: Stress-Test of Rendering Image Containing Text (EMNLP 2025, arXiv 2505.18985)](https://aclanthology.org/2025.emnlp-main.1070/) (2025-05): gpt-image-1 rendering Wikipedia text as a plain document had mean normalized edit distance 0.05 (±0.10) at 100 characters and 0.07 (±0.15) at 200 characters. The authors say GPT-4o keeps "strong performance up to approximately 800 characters". The paper reports averages only, not the share of error-free images.
- [An Empirical Study of GPT-4o Image Generation Capabilities (arXiv 2504.05979)](https://arxiv.org/abs/2504.05979) (2025-04): rates GPT-4o best-in-class at long text, yet its own highlighted examples had "fewer than three characters generated incorrectly across more than 100 characters of text".
- [Ars Technica: OpenAI's new AI image generator is potent and bound to provoke](https://arstechnica.com/ai/2025/03/openais-new-ai-image-generator-is-potent-and-bound-to-provoke/) (2025-03-27): a ChatGPT-written poem rendered by 4o image generation had "some obvious mistakes here and there, such as repeated letters".
- [Hacker News: 4o Image Generation launch thread](https://news.ycombinator.com/item?id=43474112) (2025-03-25): a tester's regenerated text-heavy diagram came back with "Westher, wntility, substittutesfor, yyears".
- [GrowthPath (Liza Adams): GPT-4o Images: Great Visuals, Text Still Needs Work](https://www.growthpath.net/gpt-4o-images-great-visuals-text-still-needs-work/) (2025-03-27): a timeline infographic rendered "Assembly Line" as "Assohly Line" and "Office Work" as "Orfice Work".
- [Ovis-Image Technical Report (arXiv 2511.22982)](https://arxiv.org/html/2511.22982v1) (2025-11): lists GPT-4o word accuracy of 0.8569 on CVTG-2K (2 to 5 text regions per image).
- [OpenAI image prompting guide](https://developers.openai.com/api/docs/guides/image-prompting) (accessed 2026-09-29): "gpt-image-1 is scheduled to shut down on October 23, 2026."

## Other side

The case for YES: GPT-4o was the best long-text renderer of spring 2025 by a wide margin, and STRICT found low average error on plain black-on-white text up to about 800 characters. A 30-word quote in large type on a plain background is easier than the posters, signs, and slides in OneIG-Bench and LongText-Bench. OneIG's completely-correct rate is also pulled down by capitalization changes that do not make the English wrong, both benchmarks read the text with an AI model (Qwen2.5-VL-7B) whose own misreadings count as errors, and bettors priced this answer at 69% at close. But the case-insensitive averages still imply more than one missed word per 30-word passage, and even the examples chosen to show off GPT-4o contained wrong characters. For 80% of images to be perfect, nearly all errors would have to pile into a few badly broken images. The reviews describe the opposite: scattered single-letter typos and doubled letters. No source found reports 8-in-10 letter-perfect 30-word passages. This keeps NO, at medium rather than high confidence because no source measures exactly this test.

## Before resolving

The exact model can still be tested directly, but only until gpt-image-1 shuts down on 2026-10-23. ChatGPT now runs much newer image models, so a test there would not count. A quick protocol using the code Ernie mentioned on 2025-04-18:

1. Write down 10 different English quotes of exactly 30 words each, mixing short and long words and including a proper noun or two.
2. For each quote, call the Images API with model `gpt-image-1` (not `gpt-image-1.5` or `gpt-image-2`), quality `high`, size `1024x1536`, `n=2`, and the prompt `A simple poster on a plain light background showing this quote in large, clear black text, exactly as written: "<quote>"`. That gives 20 images for about $5.
3. Score each image pass or fail. It passes only if every word is spelled exactly as given, with no missing, extra, repeated, or swapped words. Ignore line breaks, and decide beforehand whether a capitalization change counts; "the english is correct" suggests it does not.
4. If 16 or more of the 20 pass (80%), resolve YES; otherwise resolve NO.

If the test cannot be run before 2026-10-23, resolve on the published evidence above: NO.
