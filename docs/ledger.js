class LDate extends Date {

add(hours) {
    if (hours === true) hours = this.tz;
    let t = this.getTime() + 3600000 * hours;
    return new LDate(t);
}

get tz() {return this.getTimezoneOffset() / 60}

get array() {
    return [this.getFullYear(), this.getMonth(), this.getDate(), this.getHours(), this.getMinutes(), this.getSeconds(), this.getMilliseconds()];
}

static two(n) {return n < 10 ? `0${n}` : `${n}`}

str() {
    let [y, m, d] = this.array;
    m += 1;
    return `${y}.${LDate.two(m)}.${LDate.two(d)}`;
}

// get midnight() {return new LDate(this.str())}

static today() {return new LDate(new LDate().str())}

month(n) {
    let [y, m] = this.array;
    m += n + 1;
    while (m > 12) {y += 1; m -= 12}
    return `${y}.${LDate.two(m)}.01`;
}

}


class Ledger extends IDB {

static async open(name) {
    let store1 =  ["accounts", false, {name: false}];
    let store2 =  ["ledger", false, {date: false}];
    return IDB.open(Ledger.prefix + ':' + name, 1, store1, store2).then(db => {
        db = new Ledger(db);
        return db;
    }).then(db => {
        let acct_array, ledg;
        return db.query("accounts", 1).then(r => {acct_array = r.result}).then(() => db.query("ledger", 1, "date")).then(r => {ledg = r.result}).then(async () => {
            let accts = db.accounts = {};
            for (let a of acct_array) accts[a.number] = a;
            db.ledger = ledg;
            let i = 0;
            for (let t of ledg) if (t.number > i) i = t.number;
            db.autoCount = i + 1;
            if (db._db.upgraded) {
                let num = 1;
                for (let name of ["Assets", "Liabilities", "Equity", "Income", "Expenses"]) {
                    accts[num] = {number: num, name: name, path: [num], subacct: []};
                    db.put("accounts", 0, accts[num++]);
                }
            }
            return db;
        });
    });

}

constructor(db) {
    super(db);
    this.date1 = new LDate().month(0);
    this.date2 = new LDate().month(1);
}

get name() {return this._db.name.split(':')[1]}

json(mode, ...args) { // 0 = Original Object, 1 = Processed Object, 2 = JSON string, 3 = Download JSON
    let renum = mode == 3 && args.length > 0;
    let fn = `${this.name}${renum ? '-renumbered' : ''}.json`;
    let data = {accounts: this.accounts, ledger: this.ledger, "simple-ledger": Ledger.version};
    try {
    if (mode) { 
        // Remove account number duplication and convert ledger dates to strings
        data.accounts = {...data.accounts};
        for (let a in data.accounts) {
            data.accounts[a] = {...data.accounts[a]};
            delete data.accounts[a].number;
        }
        data.ledger = [...data.ledger];
        if (renum) Ledger._renumber(data, args);
        for (let i=0; i<data.ledger.length; i++) {
            let t = data.ledger[i] = {...data.ledger[i]};
            t.date = new LDate(t.date).str();
            delete t.number;
        }
        if (mode > 1) {
            data = JSON.stringify(data);
            if (mode == 3) {
                let url = URL.createObjectURL(new Blob([data], {"type": "application/json"}));
                $("<a>").attr({href: url, download: fn})[0].click();
                URL.revokeObjectURL(url);
            }
        }
    }
    if (renum) {
        alert(`Renumbered ledgers have been exported as '${fn}'`);
        location.href = location.pathname;
    }
    } catch(err) {
        alert(`Error: '${err}'`);
        location.reload();
    }
    return data;
}

static _renumber(data, args) {
    /* Renumber accounts */
    let accts = data.accounts;
    let ledg = data.ledger;
    for (let [n0, n1] of args) {
        if (accts[n1]) throw(`account ${n1} already exists`);
        accts[n1] = accts[n0];
        delete accts[n0];
        for (let a in accts) {
            let acct = accts[a];
            let i = acct.path.indexOf(n0);
            if (i > -1) acct.path[i] = n1;
            if (acct.subacct) {
                i = acct.subacct.indexOf(n0);
                if (i > -1) acct.subacct[i] = n1;
            }
        }
        for (let t of ledg) for (let i=0;i<t.data.length;i++) {
            if (t.data[i][0] == n0) t.data[i][0] = n1;
        }
    }
}


get date3() {return new LDate(this.date2).add(-24).str()}
set date3(d) {this.date2 = new LDate(d).add(24).str()}

get length() {
    let i = 0;
    for (let a in this.accounts) i++;
    return i;
}

date_index(date) {
    date = date == null ? new LDate() : new LDate(date);
    let ledg = this.ledger;
    let i = 0;
    while (i < ledg.length && date > ledg[i].date) i++;
    return i;
}


/* Accounts */

acct_new(name, parent, number, ph) {
    /* Create a new account */
    let accts = this.accounts;
    number = this.acct_valid(parent, number);
    if (number) {
        let acct_par = accts[parent];
        let acct = {number: number, name: name, path: [...acct_par.path, number]};
        if (ph) acct.subacct = [];
        accts[number] = acct;
        this.put("accounts", 0, acct);
        acct_par.subacct.push(number);
        this.put("accounts", 1, acct_par);
        return acct;
    }
    else throw(`cannot create account: [${parent} -> ${number}]`);
}

acct_autonum(par) {
    let accts = this.accounts;
    let num = 100 * par + 1;
    while (accts[num]) num++;
    return num;
}

acct_valid(parent, number) {
    /* Get a valid new account number */
    let accts = this.accounts;
    if (accts[parent] == null) return;
    if (!number || number < 100) number = this.acct_autonum(parent);
    return number;
}

long_name(num) {
    let accts = this.accounts;
    let s = "";
    for (let p of accts[num].path)
        s += (s.length ? " : " : "") + accts[p].name;
    return s;
}

select(filter) {
    /* Create a <select> containing an account list */
    let accts = this.accounts;
    if (filter === true) filter = a => accts[a].subacct != null;
    else if (filter === false) filter = a => accts[a].subacct == null;
    else if (filter == null) filter = a => true;
    let opt = [];
    let sel = $("<select>");
    for (let a in accts) if (filter(a)) opt.push(parseInt(a));
    opt.sort((a, b) => {
        a = this.long_name(a).toUpperCase();
        b = this.long_name(b).toUpperCase();
        return a == b ? 0 : (a < b ? -1 : 1);
    });
    for (let a of opt) $("<option>").html(this.long_name(a)).val(a).appendTo(sel);
    return sel;
}


/* Transactions */

index_of(n) {
    /* Get ledger index by transaction number */
    let i = 0;
    for (let t of this.ledger) {
        if (t.number == n) return i;
        else i++;
    }
}

tran_post(date, descr, data, number) {
    /* Post a new or modified transaction to the ledger */
    date = new LDate(date);
    let invalid = this.tran_invalid(date, descr, data);
    if (invalid) throw(`invalid transaction [code=${invalid}]: ${[date, descr, data]}`);
    else {
        let ledg = this.ledger;
        if (number) ledg.splice(this.index_of(number), 1);
        let num = number ? number : this.autoCount++;
        data = {number: num, date: date, descr: descr, data: data};
        let j = this.date_index(date);
        if (j == ledg.length) ledg.push(data);
        else ledg.splice(j, 0, data);
        this.put("ledger", num != 0, data);
    }
}

tran_invalid(date, descr, data) {
    /* Check the (in)validity of a transaction before posting */
    let accts = this.accounts;
    if (typeof(descr) != "string") return 1;
    if (!(date instanceof Date)) return 2;
    let amt = 0;
    for (let [a, d] of data) {
        a = accts[a];
        if (a == null) return 3;
        if (a.subacct != null) return 4;
        amt += d;
    }
    if (amt != 0) return 5;
    return 0;
}


/* Reports */

balances(date1, date2) {
    /* Calculate all account balances */
    let ledg = this.ledger;
    let accts = this.accounts;

    // Non-placeholder accounts
    let bals = {};
    for (let n in accts) if (accts[n].subacct == null) bals[n] = 0;
    if (date1) date1 = new LDate(date1);
    if (date2) date2 = new LDate(date2);
    let inrange = (date, num) => {
        if (date2) if (date > date2) return false;
        if (accts[num].path[0] < 4) return true;
        if (date1) if (date < date1) return false;
        return true;
    }
    for (let t of ledg) {
        let date = t.date;
        for (let [num, amt] of t.data) {
            if (inrange(date, num)) bals[num] += amt;
        }
    }

    // Placeholder accounts

    let get_bal = n => {
        if (bals[n] != null) return bals[n];
        let bal = 0;
        for (let a of accts[n].subacct) bal += get_bal(a);
        bals[n] = bal;
        return bal;
    }

    for (let i=1;i<6;i++) get_bal(i);
    return bals;
}

isdebit(a) {
    /* Return 1 for debit accounts and -1 for credit accounts */
    a = this.accounts[a].path[0];
    return a == 1 || a == 5 ? 1 : -1;
}

static money(b) {
    /* Create a <span> element to display a dollar amount */
    let s = $("<span>").addClass("Right");
    let m = (Math.abs(b) / 100).toFixed(2);
    let comma = 6, sz = m.length;
    while (sz > comma) {
        m = `${m.substring(0, sz - comma)} ${m.substring(sz - comma)}`;
        comma += 4;
        sz += 1;
    }
    m = '$' + m;
    if (b < 0) s.html(`(${m})`).addClass("Negative");
    else s.html(m);
    return s;
}

acct_ledger(n, sel) {
    /* Display an account ledger */
    let bal = this.page == "bal";
    let show = db.dialogs.filter("#Ledg_Show");

    let s = $("<span>").html(this.long_name(n)).on("click",
        bal ? ev => db.balance_sheet() : ev => db.income_statement());
    s.addClass("Link").attr({title: "Back to " + (bal ? "Balance Sheet" : "Income Statement")});

    let h2 = $("<h2>").html(s);
    s = $("<span>").addClass("Right").appendTo(h2);;
    s.html(show).append($("#Buttons").show());

    sel = $(sel ? sel : "main").html(h2);
    show = show[0].options.selectedIndex;

    let tbl = $("<table>").addClass("Ledger").appendTo(sel);
    let tr = $("<tr>").appendTo($("<thead>").appendTo(tbl));
    for (let th of ["Date", "Description", "Amount", "Balance"])
        $("<th>").html(th).appendTo(tr);
    tr.append();
    tbl = $("<tbody>").appendTo(tbl);
    bal = 0;
    let m = Ledger.money;
    let [d1, d2] = [new LDate(this.date1), new LDate(this.date2)];
    for (let i=0; i<this.ledger.length; i++) {
        let t = this.ledger[i];
        let amt;
        for (let [a, d] of t.data) if (a == n) amt = amt == null ? d : d + amt;
        if (amt != null) {
            let timing = t.date < d1 ? 1 : (t.date > d2 ? 2 : 0);
            if (timing == 0 || (timing & show)) {
                tr = $("<tr>").appendTo(tbl).attr({"data-number": t.number, title: "Edit Transaction"});
                amt *= this.isdebit(n);
                bal += amt;
                for (let td of [new LDate(t.date).str(), t.descr, m(amt), m(bal)])
                    $("<td>").html(td).appendTo(tr);
            }
        }
    }
    this.page = `ledg-${n}`;
}

print_bal(sel, nums, level) {
    /* Display the balance of an account and its subaccounts */
    let acct_depth = db.dialogs.filter("#Acct_Depth")[0].options.selectedIndex;
    if (level > acct_depth) return;
    let accts = this.accounts;
    let bals = this.balances(this.date1, this.date2);
    let title = ["New Sub-Account", "Open Account Ledger", " [Click]\nEdit Account [Ctrl + Click]"];

    let line = (name, num, amt, level, ph) => {
        let s = $("<span>").html(name);
        if (num) {
            s.attr("data-acct", num).addClass(ph ? "Link_PH" : "Link_Ledger");
            s.attr({title: level ? title[ph ? 0 : 1] + title[2]: title[0]});
        }
        let p = $("<p>").html(s).addClass("Level" + level).appendTo(sel);
        return p.append(Ledger.money(amt));
    }
    let net = -(bals[4] + bals[5]);
    for (let n of nums) {
        let acct = accts[n];
        let p = line(acct.name, n, bals[n] * this.isdebit(n), level, acct.subacct != null);
        if (n == 3) { // Equity
            let eq = bals[1] + bals[2];
            p.children("span.Right").replaceWith(Ledger.money(eq));
            if (net && acct_depth > 0) line("Net Income", null, net, 1);
        }
        else if (n == 5)
            line("Net Income", null, net, 0).addClass("Overline");
        n = acct.subacct;
        if (n) this.print_bal(sel, n, level + 1);
        sel.find("p.Overline").appendTo(sel);
    }
}

balance_sheet(sel) {
    /* Display the balance sheet */
    let s = $("<span>").html("Balance Sheet").on("click", ev => db.income_statement());
    s.addClass("Link").attr({title: "Switch to Income Statement"});
    let h2 = $("<h2>").html(s);
    s = $("<span>").addClass("Right").appendTo(h2);;
    s.html(db.dialogs.filter("#Acct_Depth")).append($("#Buttons").show());
    s = $("<span>").html(`As of ${this.date3}`).addClass("Link Edit_Date").attr({title: "Change Dates"});
    let p = $("<p>").addClass("Center").html(s);
    sel = $(sel ? sel : "main").html(h2).append(p);
    this.print_bal(sel, [1, 2, 3], 0);
    this.page = "bal";
}

income_statement(sel) {
    /* Display the income statement */
    let s = $("<span>").html("Income Statement").on("click", ev => db.balance_sheet());
    s.addClass("Link").attr({title: "Switch to Balance Sheet"});

    let h2 = $("<h2>").html(s);
    s = $("<span>").addClass("Right").appendTo(h2);;
    s.html(db.dialogs.filter("#Acct_Depth")).append($("#Buttons").show());

    // let h2 = $("<h2>").html(s).append($("#Buttons").show());

    s = $("<span>").html(`${this.date1} &ndash; ${this.date3}`).addClass("Link Edit_Date").attr({title: "Change Dates"});
    let p = $("<p>").addClass("Center").html(s);
    sel = $(sel ? sel : "main").html(h2).append(p);
    this.print_bal(sel, [4, 5], 0);
    this.page = "inc";
}

}


Ledger.prefix = "simple-ledger";
Ledger.version = "0.1.3-dev";

console.log(`Simple Ledger v${Ledger.version}`);
