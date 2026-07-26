# Changelog

This page shows a history of previous updates to Automod Neo.

### v0.3.0

* Correct behaviour of `set_locked`
* Prevent duplicate actions on posts
* Support alternate `author` name shorthand supported by OG AutoModerator e.g. `author: ['user1', 'user2']` and the corresponding `~author` check
* Fixed bug with `account_age` checks which prevented values without units from working correctly
* Fixed bug with `set_flair` actions that used dictionaries from not working
* Added `age` check on posts, comments and parent submissions
* Permit attributes to be in mixed-case
* Treat whitespace between keys and modifiers as optional (e.g. `title(regex)` now works)

### v0.2.2

* Fixed a bug checking comments where `type:` was not specified
* Add Slack webhook support via the `discord_alert` action
* Send notifications when Automod Neo is upgraded (enabled by default)
* Add `is_nsfw` attribute to post and author checks
