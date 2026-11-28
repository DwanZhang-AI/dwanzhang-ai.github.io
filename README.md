# Dwan Zhang

A personal homepage and bilingual blog hosted on GitHub Pages with Jekyll. The English homepage at `/` and the Chinese homepage at `/zh/` show a short introduction, the articles from `_posts/` in reverse chronological order, and a resume with experience, selected publications, and education. The language link opens the corresponding homepage or article.

The introduction and the resume come from `_data/profile.yml`, which holds the English and Chinese text side by side, and `_includes/home.html` renders them. Edit that file to update a job, add a paper, or change a link. A paper with no `venue` is listed as in submission.

The blog is called Data, Eval, Model. Its first post is [40 Ways to Build a Bad Verifier](https://dwanzhang-ai.github.io/posts/40-ways-to-build-a-bad-verifier/). Its English and Chinese text lives in `_data/verifier.json`, and `_includes/verifier-article.html` renders both versions. Its post front matter supplies the listing excerpts, Chinese permalink, and cover image. Jekyll generates the article feed at `/feed.xml` from `_posts/`.
