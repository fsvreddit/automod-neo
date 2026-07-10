This app replicates nearly all features of AutoModerator and adds some new features. Most existing AutoModerator rules are **fully compatible** with Automod Neo and can be copied from your existing AutoModerator config into this app's config.

[Full Documentation](https://github.com/fsvreddit/automod-neo/blob/main/documentation.md). Rules are configured in the app's settings for your subreddit.

TODO: 

* poll_option_text - The text of each option in a poll post
* poll_option_count - The number of options a poll post has.
* For crossposts, `domain`, `url` and `body` should be checked against the original submission and not the item being checked
* For a text submission, domain should be "self.subredditname"
* For gallery submissions, the optional image captions are included in evaluation of `body`
* `full-text` search method (ignores punctuation or speling on the start or end of the text being checked)
* `domain` should check either the domain or a subdomain by default
* Trigger on reports (only for rules with report_count checks)
* `set_nsfw` action
* author flair placeholders in actions
* media placeholders in actions

## Behaviour differences

All regular expressions use Javascript regex syntax. This can be different to Python regex (that used by AutoModerator) but most regular expressions that worked in OG Automod will work here too. Unlike OG AutoMod, full lookahead/lookbehind support is available. Some regexes that use Unicode code points may need to be reworked.

All regular expressions are evaluated with the Unicode flag on, allowing for constructs such as the [\p metacharacter](https://www.w3schools.com/Jsref/jsref_regexp_meta_p.asp) for more advanced searches without having to identify specific UNICODE code points.

## New features

### Author checks

These can be searched just like the title or body e.g. `bio_text (includes): 'snapchat'`.

* bio_text
* display_name
* social_links

### Parent submission and parent author actions

All actions (such as remove, set flair and so on) are now supported at the parent submission and parent submission author levels

### Crowd control checks on comments

Automod Neo supports a `comment_crowd_control_collapsed` attribute when checking comments, taking either `true` or `false` as a parameter. This used to be a supported but undocumented feature in AutoModerator but was removed some time ago.

### Discord alerts

You can use the `discord_alert` action type to send a message to a Discord webhook configured in app settings. E.g.

```yaml
discord_alert: |
  A [{{kind}}]({{permalink}}) has been posted by {{author}} that may attract rule-breaking comments.

  Please keep an eye on it!
```

### friendly_name attribute and placeholder

Rules can have an `friendly_name` attribute, useful for debugging. This can save using comments to accomplish the same thing. {{friendly-name}} is also a supported placeholder on all output (comments, modmail, Discord alerts).

## Documentation Clarification

### Multiple matches on the same attribute

AutoModerator supports an undocumented feature to do multiple matches across the same field or fields using the # syntax. Automod Neo explicitly supports this as a documented feature, and it works at all levels (base criteria, author checks, parent submissions). Example:

```yaml
body#1 (includes-word): "anonymized"
body#2 (includes-word): "Redact"
```

This would match content that hasa both the term "anonymized" and "Redact" in the name, unlike `body (includes-word): ["anonymized", "Redact"]` that would match any content that includes either of those terms. Note that the part after the # does not need to be a number, it can be any string of letters, numbers, hyphens or underscores.

## Limitations

The filter reason is currently only visible in the "modern web" modqueue, and not on mobile or Old Reddit's mod queue, or in the moderation log on any platform.

The removal action reason is currently not visible anywhere.

Both of these limitations require Reddit to make a change on either the Dev Platform or the Reddit website/mobile apps to allow these to show.

## Unsupported features

The following existing AutoModerator features are not supported due to Devvit limitations, however if it becomes possible to include them in the future, they will be implemented:

* All CQS checks
* Author flair template ID
* is_original_content on post checks
* Set Contest Mode
* Set Spoiler
* Set Original Content
* Temporary Events label

On submissions:

* discussion_type
* is_meta_discussion

This app will never support a "ban user" or "mute user" feature due to the scope for abuse.

## About this app

Automod Neo is open source. [You can find the source code on GitHub here](https://github.com/fsvreddit/automod-neo).

