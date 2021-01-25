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





/* export const threadKudos = functions.firestore.document('stream/{docID}')
  .onUpdate((change, context) => { 
    const likes = const
  }) */