# ForumTest - ATProto forum built with ESAV
its an atproto forum built with [ESAV](https://tangled.sh/@whey.party/esav), an elasticsearch-based configurable generic appview.

this project explores how far you can push ESAV as a backend with a example product (this forum atproto forum test thing). everything goes through ESAV, except for identity resolution, i have a deno deploy app that i use and share across multiple projects (is used in red dwarf too) 

i havent enabled a CDN yet so currently all images load using getBlob

Live at: [https://forumtest.whey.party](https://forumtest.whey.party)  
Discuss at: [https://forumtest.whey.party/f/@forumtest.whey.party](https://forumtest.whey.party/f/@forumtest.whey.party)

## ESAV config
custom record types:
```json
"record_types": [
  "party.whey.ft.topic.post",
  "party.whey.ft.topic.reaction",
  "party.whey.ft.topic.moderation",
  "party.whey.ft.forum.definition",
  "party.whey.ft.forum.layout",
  "party.whey.ft.forum.request",
  "party.whey.ft.forum.accept",
  "party.whey.ft.forum.category"
  ],
```

custom indexes:
```json
"index_fields": {
  "party.whey.ft.topic.reaction": {
    "subject": {
      "id": "reactionSubject",
      "type": "keyword"
    },
    "reactionEmoji": {
      "id": "reactionEmoji",
      "type": "keyword"
    }
  },
  "party.whey.ft.topic.post": {
    "text": {
      "id": "text",
      "type": "text"
    },
    "title": {
      "id": "title",
      "type": "text"
    },
    "reply.root.uri": {
      "id": "root",
      "type": "keyword"
    },
    "reply.parent.uri": {
      "id": "parent",
      "type": "keyword"
    },
    "forum": {
      "id": "forum",
      "type": "keyword"
    }
  },
  "party.whey.ft.forum.definition": {
    "description": {
      "id": "description",
      "type": "text"
    },
    "displayName": {
      "id": "displayName",
      "type": "text"
    }
  }
}

```