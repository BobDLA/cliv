# GitHub Queries

Use these commands after `git fetch --all --prune` and after pushing any local commits.

## Resolve Repo Coordinates

```bash
gh repo view --json nameWithOwner -q .nameWithOwner
```

## PR Snapshot

```bash
gh pr view <n> \
  --json number,title,headRefName,baseRefName,reviewDecision,mergeStateStatus,statusCheckRollup,isDraft,url
```

## Review Threads

```bash
gh api graphql \
  -f owner='<owner>' \
  -f repo='<repo>' \
  -F number=<n> \
  -f query='query($owner:String!, $repo:String!, $number:Int!) {
    repository(owner:$owner, name:$repo) {
      pullRequest(number:$number) {
        reviewThreads(first:50) {
          nodes {
            isResolved
            isOutdated
            path
            comments(first:20) {
              nodes {
                author { login }
                body
                url
                createdAt
              }
            }
          }
        }
      }
    }
  }'
```

## Review Summaries And Comments

```bash
gh api 'repos/<owner>/<repo>/pulls/<n>/reviews'
gh api 'repos/<owner>/<repo>/pulls/<n>/comments'
gh api 'repos/<owner>/<repo>/issues/<n>/comments'
```

## Checks And Runs

```bash
gh pr checks <n>
gh pr view <n> --json statusCheckRollup
```

Use the `detailsUrl` from `statusCheckRollup` to jump to the failing Actions run when `gh pr checks` is not enough.

## PR Write Commands

```bash
gh pr create --base <base> --head <branch> --title '<title>' --body-file <file>
gh pr edit <n> --title '<title>' --body-file <file>
gh pr close <n> --comment 'Superseded by #<new>'
gh pr comment <n> --body-file <file>
```

Prefer `--body-file` or `--body-file -` for multiline Markdown so the shell does not mangle backticks or command substitutions.
