# Automod Neo Documentation

This page is a full specificaiton about how Automod Neo's capabilities and behaviour. Automod Neo is based on AutoModerator's capabilities and specification but enhances it, adding new features and checks.

## General knowledge and behaviour

* Automod Neo's configuration is kept on your subreddit's app settings. You can configure this via your [My Communities](https://developers.reddit.com/my/communities) page, then your subreddit, and finally the Automod Neo entry in there.
* By default, submissions and comments made by moderators of the subreddit will not be checked against any rules that may cause the post to be removed or reported. You can override this behaviour with the `moderators_exempt` flag.
* Rules that may result in an item being removed (action of `remove`, `spam`, or `filter`) are always checked before all other rules in priority order, followed by all other rules in priority order.
* Rules that remove content will not run against content that has already been approved by mods, and rules that approve content will not run against content that has already been removed by mods.
* Automod Neo triggers on comment and post creation, edits and reports. For reports, only rules with a `reports` check will run.
* By default, only one rule with an action of `remove`, `spam` or `filter` will run on a given post or comment. However multiple rules without these actions can run on a given post or comment. This can be changed using the `stop_on_match` directive.

## Syntax

Automod Neo rules are defined in [YAML](https://en.wikipedia.org/wiki/YAML), so for full details about allowable syntax you can look up examples or the [YAML specification](https://yaml.org/spec/1.2.2/) if you want to dig into the full details.

If you have more than one rule defined, rules must be separated by three hyphens (`---`) on an a line by itself.

Comments can be added by using the `#` symbol. Generally everything after a `#` on a line will be treated as a comment and ignored, unless the `#` is inside a string or otherwise part of actual syntax.

Strings do not generally *need* to be quoted, but it is usually safest to put either single or double quotes around a string, especially if it includes any special characters at all. For example, the quotes here are unnecessary but encouraged:

`title: ["red", "blue", "green"]`

If you do not use quotes, there are certain types of strings that the YAML parser will try to automatically convert, which can result in unexpected behavior. In general, these include strings of numbers that start with `0` or `0x`, strings that consist of only numbers and underscores, the words `true`, `false`, `on`, `off`, `yes`, `no`, or strings starting with `>` or `|`. If in doubt, it is always safest to use quotes.

When defining regular expressions inside a search check, you should always surround the regular expression with quotes, but **single quotes** are highly encouraged. This avoids needing to double-escape. For example, these two strings on a `title` check are equivalent:

```yaml
title: ["A\\B", 'A\B']
```

Note that if you need to include a single quote inside a single-quoted string, the way to do so is by typing two single quotes in a row, not with a backslash. For example: `'it''s done like this'`.

Multi-line strings can be defined as well, these are most useful when defining multi-line comments to add as comments, as messages in Modmail or a DM to the user, or a Discord alert. To do a multi-line string, use a single `|` character on the first line and indent following lines:

```yaml
comment: |
    This is a multi-line comment.

    It has multiple lines.

    You can use **markdown** inside here too.
```

You can define lists of items in two different ways:

```yaml
title: ["red", "green", "blue"]
```

```yaml
title:
    - "red" # and you can include comments easier this way too
    - "green"
    - "blue"
```

Both formats behave exactly the same, but in some scenarios one might be more readable than the other.

Do not define the same check or action twice in the same rule - only the last one will take effect. E.g.

```yaml
title: dog
title: cat
```

Will match only "cat" on a title. If you wanted to detect titles that contained **either** `dog` or `cat`, then you would use `title: ['dog', 'cat']`. If you want to detect titles that contain **both**, there is a specific syntax you can use to indicate that they are separate checks:

```yaml
title#1: "dog"
title#2: "cat"
```

(The portion after the # is arbitrary - you could just as much do `title#dog` if you wish)

## Top-level-only checks/actions

The following checks/actions are only available in the top level of a rule, and cannot be included inside sub-groups:

* type - defines the type of item this rule should be checked against. Valid values are `comment`, `submission` (any post), `text submission` (a post without a link), `link submission`, `crosspost submission` (a post crossposted from elsewhere on Reddit), `poll submission`, `gallery submission` or any (this is the default if `type` is not specified).
* priority - must be set to a number. Can be used to define the order that rules should be checked in (though they will still always be checked in two separate groups - rules that might cause any sort of removal first - ones with action of `remove`, `spam` or `filter`, and then all others). Rules with higher numeric priority values will be checked first (i.e. a rule with priority 10 will run before priority 5). If a rule does not have a priority defined, it is treated as `priority: 0`. Negative priority values can be used as well to specify that certain rules should be checked after ones with no defined priority value.
* moderators_exempt - true/false - Defines whether the rule should be skipped when the author of the item is a moderator of the subreddit. Mods are exempt from rules that can result in a removal or report by default, so set this to false to override that behavior, or set it to true to make them exempt from any other rules.
* comment - Text of a comment to post in response to an item that satisfies the rule's conditions. Supports placeholders.
* comment_locked - true/false - if set to true, the comment Automod Neo posts in response to an item will be locked from further comment replies.
* comment_stickied - true/false - if set to true, the comment Automod Neo posts in response to an item will be stickied to the top of the submission (will have no effect on non-submissions, as the comment must be top-level)
* modmail - Text of a modmail to send to the moderators when an item satisfies the rule's conditions. Supports placeholders.
* modmail_subject - If a modmail is sent, the subject of that modmail. Defaults to "Automod Neo notification" if not set. Supports placeholders.
* message - Text of a message to send to the author of an item that satisfies the rule's conditions. Supports placeholders.
* message_subject - If a message is sent, the subject of that message. Defaults to "Automod Neo notification" if not set. Supports placeholders.
* discord_alert - Text of a message to send to a pre-configured Discord webhook. Supports placeholders.

## Sub-groups

Automod Neo supports "sub-groups" of checks and actions that can apply to things that are related to the main item being checked. There are five sub-groups that are currently supported:

* `author` is the user who submitted or updated the post/comment
* `crosspost_author` is the user who submitted the original post being crossposted (applies to crossposts only)
* `crosspost_subreddit` is the subreddit that the submission was crossposted from (applies to crossposts only)
* `parent_submission` is the post that a comment being checked was made on
* `subreddit` is the subreddit that the post or comment being checked was posted to, or the subreddit of the parent_submission.

```yaml
type: comment
body: "repost"
is_top_level: true
author:
    flair_css_class: "trusted"
parent_submission:
    set_flair: "Possible Repost"
```

## Search Checks

These checks can be used to look for words, phrases, patterns in different fields.

* Search checks can be reversed by starting the name with ~. If this is done, the check will only be satisfied if the fields being searched do NOT contain any of the options.
* Search checks can be combined by joining them with +. If this is done, the check will be satisfied if ANY of the fields joined together contain one of the options.
* Search checks are case-insensitive by default.

### For all submissions (base item or parent_submission sub-group)

* `id` - the submission's base-36 ID
* `title` - the submission's title
* `domain` - the submission's domain. For a text submission, this is "self.subredditname". For gallery submissions, the domain of the optional image outbound urls.
* `url` - the submission's full url. Cannot be checked for text submissions.
* `body` - The full text of the post. It will always be checked for text posts, and checked for other post types only when text is present.
* `flair_text` - the text of the submission's link flair
* `flair_css_class` - the css class of the submission's link flair
* `flair_template_id` - the template id of the submission's link flair
* `poll_option_text` - The text of any option in a poll post

### For crossposts submissions

The following fields will always be checked against the fields of the original submission.

* `domain` - if the submission is a crosspost, then check the domain of the original submission
* `url` - if the submission is a crosspost, then check the full url of the original submission
* `body` - if the submission is a crosspost, then check the body of the original submission

In addition, we have the following fields that will check the original submission. If the submission isn't a crosspost, then a rule with any of these attributes will be ignored.

* `crosspost_id` - if the submission is a crosspost, then check the base-36 ID of the original submission
* `crosspost_title` - if the submission is a crosspost, then check the title of the original submission

### Media checks

On submissions, it is also possible to do some checks against the "media object" that gets embedded in reddit. If the submission is a crosspost, then the values of the original submission are checked. The media data that is available comes from embed.ly, so you can see what information is available for a specific link by testing it here: http://embed.ly/extract

* `media_author` - the author name returned from embed.ly (usually the username of the uploader on the media site)
* `media_author_url` - the author's url returned from embed.ly (usually the link to their user page on the media site)
* `media_title` - the media title returned from embed.ly

### For comments (base item only)

* `id` - the comment's base-36 ID
* `body` - the full text of the comment.

### For users (inside author, parent submission author or crosspost_author sub-group)

* `id` - the user's base-36 ID
* `name` - the user's username
* `flair_text` - the text of the user's flair in the subreddit
* `flair_css_class` - the css class of the user's flair in the subreddit
* `bio_text` - the user's "About description"
* `display_name` - the user's display name
* `social_links` - the user's social URLs

### For subreddits (inside subreddit or crosspost_subreddit)

* `name` - the name of the subreddit where the original submission was posted

## Matching modifiers

These modifiers change how a search check behaves. They can be used to ensure that the field being searched starts with the word/phrase instead of just including it, allow you to define regular expressions, etc.

To specify modifiers for a check, put the modifiers in parentheses after the check's name. For example, a body+title check with the includes and regex modifiers would look like:

```yaml
body+title (includes, regex): ["whatever", "who cares?"]
```

### Match search methods

These modifiers change how the search options for looked for inside the field, so only one of these can be specified for a particular match. body will always be checked for text posts, and checked for other post types only when text is present.

* `includes-word` - searches for an entire word matching the text
* `includes` - searches for the text, regardless of whether it is included inside other words
* `starts-with` - only checks if the subject starts with the text
* `ends-with` - only checks if the subject ends with the text
* `full-exact` - checks if the entire subject matches the text exactly
* `full-text` - similar to full-exact, except punctuation/spacing on either end of the subject is not considered

### Other modifiers

* `regex` - considers the text being searched for to be a regular expression (using standard Javascript regex syntax), instead of literal text to find
* `case-sensitive` - makes the search case-sensitive, so text with different capitalization than the search value(s) will not be considered a match

If you do not specify a search method modifier for a particular check, it will default to one depending on which field you are checking. Note that if you do any joined search check (multiple fields combined with +), the default is always includes-word. Otherwise, if you are checking a single subject field, the defaults are as follows:

* `domain`: special check that looks only for the exact domain or a subdomain of it
* `id`: `full-exact`
* `url`: `includes`
* `flair_text`: `full-exact`
* `flair_css_class`: `full-exact`
* `flair_template_id`: `full-exact`
* `media_author`: `full-exact`
* `media_author_url`: `includes`
* `social_links`: `includes`

All other fields default to includes-word.

### Non-searching checks

Other checks that can be used that are not search checks, so do not take a value or list of values to look for, cannot be joined with + or reversed with ~.

### For all submissions and comments

* `reports` - must be set to a number. The minimum number of reports the submission must have to trigger the rule.
* `body_longer_than` - must be set to a number. The submission's body must be longer than this number of characters to trigger the rule (spacing and punctuation characters on either end are not counted). This will always be checked for text posts, and checked for other post types only when text is present.
* `body_shorter_than` - must be set to a number. The submission's body must be shorter than this number of characters to trigger the rule (spacing and punctuation characters on either end are not counted). This will always be checked for text posts, and checked for other post types only when text is present.
* `is_edited` - true/false - if set to true, submissions will only trigger the rule if they have been edited. if set to false, submissions will only trigger the rule if they have NOT been edited (so new submissions will be checked against the rule, but they will not be re-checked on edit).

### For submissions only (base item or parent_submission sub-group)

* `is_poll` - true/false - if set to true, submissions will only trigger the rule if they are of the poll submission type.
* `is_gallery` - true/false - if set to true, submissions will only trigger the rule if they are of the gallery submission type.
discussion_type - chat/null - if set to chat, then it will apply to chat posts. if set to null it will apply to comment posts. if this is not specified it will apply to both
* `past_archive_date` - true/false - if set to true, submissions will only trigger the rule if they are older than the archival date of 6 months. See this post for details.
* `poll_option_count` - The number of options a poll post has in the form `poll_option_count: 3` (to match the exact number), `poll_option_count: '> 2'` (for a comparison)

### For comments (base item only)

* `is_top_level` - true/false - if set to true, comments will only trigger the rule if they are top-level comments (posted in reply to the submission itself, not to another comment). If set to false, comments will only trigger the rule if they are NOT top-level comments (posted in reply to another comment).

### For subreddits

* `is_nsfw` - true/false - If true, will only match if the subreddit of the original submission is NSFW

### For users (inside author, crosspost_author sub-group, or parent_submission author sub-group)

#### Karma/age threshold checks

These checks are most often used as "thresholds" - greater than or less than checks. They can be specified using the < or > symbol followed by the value to check if the author has more or less than. For example, to check if the author has less than 10 post karma, the check would be:

```yaml
author:
    post_karma: < 10
```

Note that due to the > symbol having a special meaning in YAML syntax, you must put quotes around a greater-than check, but it is not necessary for less-than checks. For example, a check to see if the author has more than 10 post karma would have to be written as:

```yaml
author:
    post_karma: '> 10'
```

The supported threshold checks are:

* `comment_karma` - compare to the author's comment karma (note that comment karma will not go below -100)
* `post_karma` - compare to the author's post karma (note that post karma will not go below 0)
* `combined_karma` - compare to the author's combined (comment karma + post karma, combination can not be below -100)
* `comment_subreddit_karma` - compare to the author's comment karma in your community (note that comment karma will not go below -100)
* `post_subreddit_karma` - compare to the author's post karma in your community (note that post karma will not go below 0)
* `combined_subreddit_karma` - compare to the author's combined (comment karma + post karma) karma in your community (comment karma + post karma, combination can not be below -100)
* `account_age` - compare to the age of the author's account. This check also supports specifying a unit (default is days), so you can specify something like account_age: < 60 hours. Supported units are minutes, hours, days, weeks, months, and years.

* `satisfy_any_threshold` - true/false - If true and any karma or age threshold checks are being done, only one of the checks will need to be successful. If false, ALL the checks will need to be satisfied for the rule to trigger (this is the default behavior).

#### Other user checks

* `has_verified_email`- true/false - if true, will only match if the author has a verified email address or a phone number. If false, will only match if the author does not have neither a verified email address nor a phone number.
* `is_gold` - true/false - If true, will only match if the author has reddit gold. If false, will only match if they do not have gold.
* `is_submitter` - true/false - (only relevant when checking comments) If true, will only match if the author was also the submitter of the post being commented inside. If false, will only match if they were not.
* `is_contributor` - true/false - if true, will only match if the author is a contributor/"approved submitter" in the subreddit. If false, will only match if they are not.
* `is_moderator` - true/false - if true, will only match if the author is a moderator of the subreddit. If false, will only match if the author is NOT a moderator of the subreddit.

## Actions

### For submissions (base item or parent_submission sub-group)

* `action` - A moderation action to perform on the item. Valid values are `approve`, `remove`, `spam`, `filter`, or `report`.
* `action_reason` - Displays in the moderation log as a reason for why a post was approved or removed. If the action is report, displays as the report reason instead. Supports placeholders.
* `set_flair` - Takes either a single string, a list of two strings or a dictionary. If given a single string, the submission's flair text will be set to the string. If given two strings, the first string will be used for the flair text, and the second string for the flair css class. If given a dictionary, the keys will be one of 'text', 'css_class', or 'template_id'. If set, the value of 'text' will be used for the flair text and the value of 'css_class' will be used for the css class. When using the dictionary syntax, 'template_id' must be set, and the value of 'template_id' will be used to set the flair template (template Ids are accessible in Post Flair and User Flair sections of Mod Tools). The flair text, flair css class and flair template id can include placeholders.
* `overwrite_flair` - true/false - If true, a set_flair action will overwrite any previous link flair on the submission. If false (same as default behavior), any existing flair will not be overwritten.
* `set_sticky` - true/false or a number - Sets or unsets the matched submission as a sticky in the subreddit. If you use a number (for example set_sticky: 1), the post will replace any existing sticky in that slot. Using true will work the same as clicking the "sticky this post" link on the post - it will go into the bottom sticky slot (replacing a post that's already there, if necessary).
* `set_nsfw` - true/false - Enables (true) or disables (false) the NSFW flag on the submission.
* `set_locked` - true/false - Locks or unlocks the submission or comment.
* `set_post_crowd_control_level` - Sets the Crowd Control level of a submission. Valid values are OFF, LENIENT, MEDIUM, and STRICT.

### For comments (base item only)

* `action` - A moderation action to perform on the item. Valid values are `approve`, `remove`, `spam`, `filter` or `report`
* `report_reason` - If the action is report, sets the report reason that will be used. Supports placeholders.

### For users (inside author or crosspost_author sub-group)

* `set_flair` - Takes either a single string, a list of two strings or a dictionary. If given a single string, the submission's flair text will be set to the string. If given two strings, the first string will be used for the flair text, and the second string for the flair css class. If given a dictionary, the keys will be one of 'text', 'css_class', or 'template_id'. If set, the value of 'text' will be used for the flair text and the value of 'css_class' will be used for the css class. When using the dictionary syntax, 'template_id' must be set, and the value of 'template_id' will be used to set the flair template (template Ids are accessible in Post Flair and User Flair sections of Mod Tools).
* `overwrite_flair` - true/false - If true, a set_flair action will overwrite any previous user flair. If false (same as default behavior), any existing flair will not be overwritten.

### Other directives

* `ignore_blockquotes` - true/false - If set to true, any text inside blockquotes will not be considered by this rule when doing search checks against body, or counting length with body_shorter_than/body_longer_than.
* `stop_on_match` - true/false. By default, any rule with an action of `remove`, `spam` or `filter` is treated as `stop_on_match: true`, and other rules as `stop_on_match: false` to match OG AutoModerator functionality.

### Placeholders

When used inside a string that supports placeholders, these will be replaced with the appropriate value. For crossposts, the `{{body}}`, `{{domain}}`, and `{{url}}` are replaced by the value of the original submission. This allows including information about a post or its author in modmail or report reasons, setting flair to something based on the post that triggered it to be set, etc.

* `{{author}}` - the author's name (do /u/{{author}} for a link to the author's user page)
* `{{author_flair_text}}` - the author's flair text (will be replaced with nothing if they have no flair set, or have it disabled)
* `{{author_flair_css_class}}` - the author's flair CSS class (will be replaced with nothing if they have no flair set, or have it disabled)
* `{{body}}` - the full body text of the text submission or comment
* `{{permalink}}` - a link to the item
* `{{subreddit}}` - the subreddit's name (do /r/{{subreddit}} for a link to the subreddit)
* `{{kind}}` - replaced with "submission" for submissions or "comment" for comments
* `{{title}}` - the submission's title
* `{{domain}}` - the submission's domain
* `{{url}}` - the submission's full url

### Media placeholders

Note that if you use a media placeholder anywhere in a rule, it will make it so that the rule is not applied to any objects where this data is not available.

* `{{media_author}}` - the media's author username
* `{{media_author_url}}` - the media's author url
* `{{media_title}}` - the media's title

### Match placeholders

There is also one other special type of placeholder that can be used to show information about which words/phrases were matched by a search check on the base item (not search checks inside a sub-group like author: or parent_submission:). In its most basic form it is simply `{{match}}` and will be replaced with whichever option in your search check matched something in the item. For example, this condition would give a submission a flair css class corresponding to the color that they use in their title:

```yaml
title: ["red", "green", "blue"]
set_flair: ["", "{{match}}"]
```

In the case of multiple search checks, you must specify which check to take the match from, or you may end up with unexpected behavior. For example, if the same rule also includes a search on domain, you should specify that you want the match from the title search with `{{match-title}}`:

```yaml
title: ["red", "green", "blue"]
domain: [youtube.com, youtu.be]
set_flair: ["", "{{match-title}}"]
```

And finally, it is also possible to use the match placeholder to specify individual capture groups from a regular expression search check. This is done by adding the number of the capture group at the end of the placeholder, but be aware that `{{match}}` is the same as `{{match-1}}`, and will be replaced with the entire matched word/phrase. Capture groups defined inside your regex with parentheses start at `{{match-2}}`. You can also specify the specific search match along with this, such as `{{match-title-2}}`.

### Standard conditions

Standard conditions allow you to make use of some pre-defined checks such as "image hosting sites" and "video hosting sites" that maintain a list of common domains, so that you do not need to manually define your own list. To use a standard condition, simply define standard: along with the check's name. **You can only define a single standard condition inside a rule**. For example, to remove submissions from common image hosts:

```yaml
standard: image hosting sites
action: remove
```

The available standard conditions are:

* `image hosting sites` - will match link submissions from common image hosting domains
* `direct image links` - will match link submissions that link directly to image files (PNG, JPG, GIF, GIFV)
* `video hosting sites` - will match link submissions from common video hosting domains
* `streaming sites` - will match link submissions from common streaming domains
* `crowdfunding sites` - will match link submissions from common crowdfunding domains
* `meme generator sites` - will match link submissions from common meme-generator sites
* `facebook links` - will match submissions or comments including links to Facebook
* `amazon affiliate links` - will match submissions or comments including Amazon links with an affiliate code

If you want to look at the specifics of what a particular standard condition will match, the definitions are available for reference on the [standard conditions page](https://www.reddit.com/r/reddit.com/wiki/automoderator/standard-conditions).
