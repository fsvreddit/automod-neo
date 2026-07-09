This app replicates nearly all features of AutoModerator and adds some new features.

For documentation, please see the official AutoModerator documentation but note the differences below. Rules are configured in the app's con

## Behaviour differences

All regular expressions use Javascript regex syntax. This can be different to Python regex (that used by AutoModerator) but most regular expressions that worked in OG Automod will work here too. Unlike OG AutoMod, full lookahead/lookbehind support is available. Some regexes that use Unicode code points may need to be reworked.

All regular expressions are evaluated with Unicode mode on, allowing for placeholders such as `\p{Emoji}`.

## New features

### Author checks

These can be searched just like the title or body e.g. `bio_text (includes): 'snapchat'`.

* bio_text
* display_name
* social_links

### Parent submission and parent author actions

All actions (such as remove, set flair and so on) are now supported at the parent submission and parent submission author levels

### Discord alerts

You can use the `discord_alert` action type to send a message to a Discord webhook configured in app settings.

### friendly_name attribute and placeholder

Rules can have an `friendly_name` attribute, useful for debugging. This can save using comments to accomplish the same thing. {{friendly-name}} is also a supported placeholder on all output (comments, modmail, Discord alerts).

## Documentation Clarification

AutoModerator supports an undocumented feature to do multiple matches across the same field or fields using the # syntax. Automod Neo explicitly supports this as a documented feature, and it works at all levels (base criteria, author checks, parent submissions). Example:

```yaml
body#1 (includes-word): "anonymized"
body#1 (includes-word): "Redact"
```

This would match content that hasa both the term "anonymized" and "Redact" in the name, unlike `body (includes-word): ["anonymized", "Redact"]` that would match any content that includes either of those terms.

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

## Things I will never do

This app will never support a "ban user" or "mute user" feature, sorry. I can see too much scope for abuse.

## About this app

Automod Neo is open source. [You can find the source code on GitHub here](https://github.com/fsvreddit/automod-neo).
