class IDB {

/*** Usage...

let db, name = "idb_test";
let store1 =  ["store1", true, {date: false, name: false}];
let store2 =  ["store2", false, {date: false}];
IDB.open(name, 1, store1, store2).then(r => {
    db = new IDB(r);
    db.put("store1", 1, {name: "Fred", number: 2})
    db.put("store1", 1, {name: "Barney", number: 1})
    db.query("store1", 1, "name", "Fred").then(console.log);
});

 ***/


static async open(name, ver, ...stores) {
    return new Promise((resolve, reject) => {
        let openRequest = indexedDB.open(name, ver? ver : 1);

        openRequest.onupgradeneeded = () => {
            let db = openRequest.result;
            db.upgraded = true;
            for (let [name, args, index] of stores) {
                if (args === true) args = {keyPath: "number", autoIncrement : true};
                else if (args === false) args = {keyPath: "number"};
                let s = db.createObjectStore(name, args);
                for (let i in index) {
                    let opt = index[i];
                    s.createIndex(i, i, opt === true ? {unique: true} : (opt === false ? {unique: false} : opt));
                }
            }
        }

        openRequest.onerror = () => reject(openRequest);
        openRequest.onsuccess = () => resolve(openRequest.result);
    });
}

constructor(result) {this._db = result}
close() {this._db.close()}

async query(store, all, index, args) {
    return new Promise((resolve, reject) => {
        let q;
        try {
            let tr = this._db.transaction(store, "readonly");
            store = tr.objectStore(store);
            if (index) {
                index = store.index(index);
                q = all ? index.getAll(args) : index.get(args);
            }
            else q = all ? store.getAll(args) : store.get(args);

            tr.oncomplete = ev => {
                let r = q.result;
                if (r == null) r = [];
                resolve({event: ev, result: r instanceof Array ? r : [r]});
            }

        } catch(err) {
            reject({error: err, result: []});
        }
    });
}

async put(store, overwrite, ...data) {
    /* Add or overwrite data */
    return new Promise((resolve, reject) => {
        let tr = this._db.transaction(store, "readwrite");
        store = tr.objectStore(store);
        for (let d of data) {
            if (overwrite) store.put(d);
            else store.add(d);
        }
        tr.oncomplete = resolve;
        tr.onerror = reject;
    });
}

async del(store, key) {
    /* Delete record */
    return new Promise((resolve, reject) => {
        let tr = this._db.transaction(store, "readwrite");
        tr.objectStore(store).delete(key);
        tr.oncomplete = resolve;
        tr.onerror = reject;
    });
}

}
