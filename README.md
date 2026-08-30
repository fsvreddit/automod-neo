This app replicates nearly all features of AutoModerator and adds some new features. Most existing AutoModerator rules are **fully compatible** with Automod Neo and can be copied from your existing AutoModerator config into this app's config.

[Full Documentation](https://github.com/fsvreddit/automod-neo/blob/main/documentation.md). Rules are configured in the app's settings for your subreddit.

## Behaviour differences

All regular expressions use Javascript regex syntax. This can be different to Python regex (that used by AutoModerator) but most regular expressions that worked in OG Automod will work here too. Unlike OG AutoMod, full lookahead/lookbehind support is available. Some regexes that use Unicode code points or other Python-specific syntax may need to be reworked.

All regular expressions are evaluated with the Unicode flag on, allowing for constructs such as the [\p metacharacter](https://www.w3schools.com/Jsref/jsref_regexp_meta_p.asp) for more advanced searches without having to identify specific UNICODE code points.

Rules run on a short delay of up to a few seconds in most situations.

Because of these two factors, **I recommend only using Automod Neo at this stage for use cases that AutoModerator does not support**, such as the additional user properties, time-of-day checks, Discord alerts, or similar.

## New features

Automod Neo supports several features not supported by OG AutoModerator.

* `bio_text`, `display_name` and `social_links` for authors
* All actions (remove, set flair, comment and so on) are supported for the parent submission and author
* Ability to check and action `parent_comment` for non-top level comments
* `day_of_week` checks for rules that should only run on some days, with a configurable time zone
* `stop_on_match` directive to override the default behaviour of stopping processing after a remove/spam rule, or continuing otherwise
* `comment_crowd_control_collapsed` check on comments
* `user_report_reason` and `mod_report_reason` search checks (works similarly to title/body/etc. checks)
* `image_count` checks for image/gallery submissions
* `comment_count` checks for all submissions
* `is_approved` checks, to allow rules to be ignored if a mod has specifically approved a post or comment
* `discord_alert` action (also supports Slack)
* `friendly_name` property on rules, with the corresponding `{{friendly-name}}` placeholder on all output.

## Limitations

The filter reason is currently only visible in the "modern web" modqueue, and not on mobile or Old Reddit's mod queue, or in the moderation log on any platform.

The removal action reason is currently not visible anywhere.

Both of these limitations require Reddit to make a change on either the Dev Platform or the Reddit website/mobile apps to allow these to show.

## Unsupported features

The following existing AutoModerator features are not supported due to Devvit limitations, however if it becomes possible to include them in the future, they will be implemented:

* All CQS checks
* Author flair template ID checks for parent submissions
* is_original_content on post checks
* Set Contest Mode
* Set Original Content
* Temporary Events label
* the `media_description` check and associated placeholder

On submissions:

* discussion_type
* is_meta_discussion

This app will never support a "ban user" or "mute user" feature due to the scope for abuse.

## Future developments

* An Automod configuration UI that includes syntax highlighting. This will require future Dev Platform capabilities that don't exist yet.
* More detections and actions (Ask me what you'd find useful!)

## Recent changes

For older changes, please see the [full changelog](https://github.com/fsvreddit/automod-neo/blob/main/changelog.md)

### v0.6.1

* Fix broken validation of `is_nsfw` for the base submission item

### v0.6.0

* `comment` and `comment_stickied` now works for parent submissions
* Add `is_approved` check on posts, comments and parent submissions
* Fix behaviour of `includes-word` search checks where the search term starts with punctuation
* Add `parent_comment` checks and actions
* Add `image_count` check on post checks
* Add `user_report_reason` and `mod_report_reason` check on posts and comments
* Improve reliability of comment submission to work around Reddit rate limiting issues
* Performance improvements

## About this app

Automod Neo is open source. [You can find the source code on GitHub here](https://github.com/fsvreddit/automod-neo).

Thanks to u/CR29-22-2805 for submitting several bug fixes to this project.
