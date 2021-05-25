import * as functions from 'firebase-functions';
import algoliasearch from 'algoliasearch'
import admin = require('firebase-admin');

// // Start writing Firebase Functions
// // https://firebase.google.com/docs/functions/typescript
//
// export const helloWorld = functions.https.onRequest((request, response) => {
//   functions.logger.info("Hello logs!", {structuredData: true});
//   response.send("Hello from Firebase!");
// });

const ALGOLIA_ID = functions.config().algolia.app_id
const ALGOLIA_ADMIN_KEY = functions.config().algolia.api_key
// const ALGOLIA_SEARCH_KEY = functions.config().algolia.search_key

const ALGOLIA_INDEX_NAME = 'pelilauta_discussion';
const client = algoliasearch(ALGOLIA_ID, ALGOLIA_ADMIN_KEY)

admin.initializeApp()
const db = admin.firestore()

export interface Notification {
  source: {
    type: string
    id: string
    title: string
    message?: string
  }
  meta: {
    new?: boolean
    author?: string
  }
}


// Update the search index every time a thread post is written.
export const onThreadCreated = functions.firestore.document('stream/{threadId}').onCreate((snap, context) => {
  // Get the note document
  const note = snap.data()
  // Add an 'objectID' field which Algolia requires
  note.objectID = context.params.threadId
  note.objecType = 'thread'

  if (!client) throw new Error('algoliaClient not started')

  // Write to the algolia index
  const index = client.initIndex(ALGOLIA_INDEX_NAME)
  
  if (!index) throw new Error('could not init index ' + ALGOLIA_INDEX_NAME)

  return index.saveObject(note).then(() => {
    return db.collection('meta').doc('pelilauta').get().then((metadoc) => {
      const streams = metadoc.data()?.streams
      streams[note.topic].count = streams[note.topic].count + 1
      return db.collection('meta').doc('pelilauta').update({streams: streams})
    })
  })
})

export const onThreadDeleted = functions.firestore.document('stream/{threadId}').onDelete((snap, context) => {
  // Get the note document
  const note = snap.data()
  return db.collection('meta').doc('pelilauta').get().then((metadoc) => {
    const streams = metadoc.data()?.streams
    streams[note.topic].count = streams[note.topic].count - 1
    return db.collection('meta').doc('pelilauta').update({streams: streams})
  })
})

// Update the search index every time a thread post is written.
export const onThreadUpdated = functions.firestore.document('stream/{threadId}').onUpdate((snap, context) => {
  // Get the note document
  const note = snap.after.data()
  // Add an 'objectID' field which Algolia requires
  note.objectID = context.params.threadId
  note.objecType = 'thread'

  if (!client) throw new Error('algoliaClient not started')

  // Write to the algolia index
  const index = client.initIndex(ALGOLIA_INDEX_NAME)
  
  if (!index) throw new Error('could not init index ' + ALGOLIA_INDEX_NAME)

  return index.saveObject(note)
})
/**
 * a comment is added to a thread.
 * 1. Add a notification to original author
 */
export const onCommentAdded = functions.firestore.document('stream/{threadId}/comments/{commentId}').onCreate((snap, context) => {

  // Get the reply document
  const update = snap.data()
  const threadId = context.params.threadId
  // const commentId = context.params.commentId

  // Get the parent thread
  const parent = snap.ref.parent.parent
  return parent?.get().then((threadDoc) => {
    // Make a notification  to the thread author
    const threadAuthor = threadDoc.data()?.author
    const inboxRef = db.collection('inbox').doc(threadAuthor)
    return inboxRef.get().then((inboxDoc) => {
      let m = inboxDoc.data()?.notifications
      if (!m) m = new Array<Notification>()
      m.push({
        source: {
          type: 'thread.reply',
          id: threadId as string || '...',
          title: threadDoc.data()?.title as string || '...',
          message: 'notification.newThreadReply'
        },
        meta: {
          new: true,
          author: update?.author as string || '-'
        }
      })
      return inboxRef.update({ notifications: m})
    })
  })

  // Get the note document
  /* const parent = snap.ref.parent.parent
  if (parent) {
  parent.get().then((threadDoc) => {
    const threadAuthor = threadDoc.data()?.author
      if (threadAuthor) {
        db.collection('profiles').doc(threadAuthor).collection('meta').doc('props').get().then((authorData) => {
          const messagingToken = authorData.data()?.messagingToken
          if (messagingToken) {
            admin.messaging().send({
              notification: {
                title: threadDoc.data()?.title || '',
                body: snap.data()?.content || ''
              },
              webpush: {
                fcmOptions: {
                  link: 'https://pelilauta.web.app/thread/view/'+parent?.id
                }
              },
              token: messagingToken
            }).then((response) => {
              // Response is a message ID string.
              console.log('Successfully sent message:', response)
              return 'sent message to ' + threadDoc.data()?.author
            })
            .catch((error) => {
              console.log('Error sending message:', error)
            })
          }
        }).catch((error) => {
          console.log('Error sending message:', error)
        })
      }
    }).catch((error) => {
      console.log('Error sending message:', error)
    })
  } */
})


// Update the search index every time a thread post is written.
export const onWikiPageCreated = functions.firestore.document('sites/{siteid}/pages/{pageid}').onCreate((snap, context) => {
  // Get the note document
  const update = snap.data()
  const siteid = context.params.siteid
  const pageid = context.params.pageid

  return db.collection('pagelog').doc(`${siteid}.${pageid}`).set({
    action: 'create',
    siteid: siteid,
    pageid: pageid,
    name: update?.name || pageid,
    content: update?.htmlContent || '- no content -',
    author: update?.author || '- unknown author id -',
    changetime: update?.created || null
  })
})
// Update the search index every time a thread post is written.
export const onWikiPageUpdated = functions.firestore.document('sites/{siteid}/pages/{pageid}').onUpdate((snap, context) => {
  // Get the note document
  const update = snap.after.data()
  const siteid = context.params.siteid
  const pageid = context.params.pageid

  // by default, log everything, omit pages that are hidden, or ask for silent update
  if (update?.hidden) return

  return db.collection('pagelog').doc(`${siteid}.${pageid}`).set({
    action: 'update',
    siteid: siteid,
    pageid: pageid,
    silent: update?.silent || false,
    name: update?.name || pageid,
    content: update?.htmlContent || '- no content -',
    author: update?.author || '- unknown author id -',
    changetime: update?.lastUpdate || null
  })
})
