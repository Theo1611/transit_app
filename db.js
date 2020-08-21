import FireBase from 'firebase';
let config = {
    apiKey: "AIzaSyC08yO8W0jFYn5S58KA6Ok9cwchQut1CBI",
    authDomain: "rn-project-7b00d.firebaseapp.com",
    databaseURL: "https://rn-project-7b00d.firebaseio.com",
    projectId: "rn-project-7b00d",
    storageBucket: "rn-project-7b00d.appspot.com",
    messagingSenderId: "36076582746"
  };

let app = FireBase.initializeApp(config);
export const db = app.database();