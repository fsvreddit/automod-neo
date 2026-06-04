This app replicates AutoModerator and adds some new features.

## Behaviour differences

All regular expressions use Javascript regex syntax. This can be different to Python regex (that used by AutoModerator) but most regular expressions that worked in OG Automod will work here too. Unlike OG AutoMod, full lookahead/lookbehind support is available.

All regular expressions are evaluated with Unicode mode on, allowing for placeholders such as `\p{Emoji}`.

The only joined checks supported are `title+body` (and `body+title`) and not other checks.

## Todo

Author checks on parent submissions (full parity with base author conditions)
Discord alerts using configurable webhooks

## New features

### Author checks (base item only)

These can be searched just like the title or body e.g. `bio_text (includes): 'snapchat'`.

* bio_text
* display_name
* social_links

## Unsupported features

The following are not supported due to Devvit limitations.

* All CQS checks
* Author flair template ID
* is_original_content on post checks
* Set Contest Mode
* Set Spoiler
* Set Original Content

On submissions:

* discussion_type
* is_meta_discussion
