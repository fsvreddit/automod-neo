# Changelog

This page shows a history of previous updates to Automod Neo.

### v0.5.0

* Add `~day_of_week` directive to the base item
* Fall back to outgoing modmail if users have chats disabled when using `message` directive
* Internal modmail notifications no longer include the "I am a bot..." footer
* DMs to users and internal modmail notifications now include the permalink of the post/comment they relate to
* DMs to users and replies left to posts/comments now prepopulate the message body with the permalink of the post/comment they relate to in the "message the moderators of this subreddit" link
* Add `comment_count` check for posts
* Better message/modmail subject defaults
* {{title}} placeholder now works consistently with AutoModerator even for rules that react to comments
* Add {{parent_submission_author}} placeholder for rules that act on comments
* Add option to skip processing rules on posts or comments that AutoModerator has already acted on
* Prevent duplicate comments from being added if a rule runs more than once on a post or comment
* Add `is_banned` check on all `author` nodes

### v0.4.0

* Reinstate support for `flair_template_id` checks on the base item author
* Add support for non-alphanumeric characters +, - and _ after # differentiators on search checks
* Add `social_link_title` search check on authors
* Add `day_of_week` directive to the base item
* Fixed `body_shorter_than` and `body_longer_than` when checking posts
* Fixed Slack webhook support

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
