

let db, databases = [];

function cover(dialog) {
    let cover = $("#Cover, #PopUp");
    if (dialog === false) {
        db.dialogs.remove();
        cover.hide();
    }
    else {
        cover.show();
        if (dialog) {
            $("#PopUp").html(db.dialogs.filter(dialog));
            center_dialog();
        }
    }
}

function center_dialog(dlg) {
    dlg = $(dlg ? dlg : "#PopUp");
    let win = $(window);
    let w = dlg.outerWidth();
    let x = (win.width() - w) / 2;
    let h = dlg.outerHeight();
    let y = (Math.min($("body").height(), win.height()) - h) / 2;
    dlg.css({left: `${x}px`, top: `${Math.max(y, 16)}px`});
}

function go_main() {
    cover(false);
    let pg = db.page.split("-");
    switch(pg[0]) {
        case "bal": db.balance_sheet(); break;
        case "inc": db.income_statement(); break;
        case "ledg": db.acct_ledger(parseInt(pg[1])); break;
    }
}

function edit_date() {
    let id = "#Edit_Date";
    cover(id);
    let dates = $(id).find("input[type=date]");
    dates[0].valueAsDate = new LDate(db.date1);
    dates[1].valueAsDate = new LDate(db.date3);
}

edit_date.okay = () => {
    let dates = $("#Edit_Date input[type=date]");
    let d1 = new LDate(dates[0].valueAsDate).add(true);
    let d3 = new LDate(dates[1].valueAsDate).add(true);
    db.date1 = d1.str();
    db.date3 = d3.str();
    go_main();
}

function acct_edit(acct, create_sub) {
    create_sub = create_sub == true;
    let depth_limit = db.accounts[acct].path.length >= (db.max_depth - 1) && create_sub;
    let id = "#Acct_Edit", parent;
    cover(id);
    let dlg = $(id).attr("data-info", `${acct},${create_sub ? 1 : 0}`);
    let anum = $("#Acct_Num");
    dlg.children("h2").html(create_sub ? "New Sub-Account": "Edit Account");
    let sel = db.select(true).attr({title: "Parent Account"})[0];
    dlg.find("select").replaceWith(sel);

    let ph = $("#Acct_PH")[0];
    ph.disabled = !create_sub || depth_limit;

    if (create_sub) {
        parent = acct;
        acct = db.acct_autonum(parent);
        $("#Acct_Name").val("");
    }
    else {
        let a = db.accounts[acct];
        let p = a.path;
        parent = p[p.length - 2];
        $("#Acct_Name").val(a.name);
        ph.checked = a.subacct != null;
    }
    if (depth_limit) ph.checked = false;

    let opt = sel.options;
    for (let i=0;i<opt.length;i++) if (opt[i].value == parent) opt.selectedIndex = i;

    let auto = $("#Acct_Auto")[0];
    anum[0].disabled = auto.checked = true;
    auto.disabled = !create_sub;
    anum.val(acct);
}

acct_edit.okay = () => {
    let dlg = $("#Acct_Edit");
    let [acct, create_sub] = dlg.attr("data-info").split(',');
    let [name, num, ph] = [$("#Acct_Name").val(), parseInt($("#Acct_Num").val()), $("#Acct_PH")[0].checked];
    let par = dlg.find("select")[0].options;
    par = parseInt(par[par.selectedIndex].value);
    if (create_sub == '1') db.acct_new(name, par, num, ph);
    else {
        let accts = db.accounts;
        acct = accts[parseInt(num)];
        acct.name = name;
        let args = [acct];
        let old = acct.path;
        old = old[old.length - 2];
        if (old != par) {
            old = accts[old];
            par = accts[par];
            acct.path = [...par.path, num];
            par.subacct.push(num);
            let n = old.subacct.indexOf(num);
            old.subacct.splice(n, 1);
            args.push(par);
            args.push(old);
        }
        db.put("accounts", 1, ...args);
    }
    go_main();

}

function on_acct_auto(e) {$("#Acct_Num")[0].disabled = e.checked}

function click_acct(num) {
    // if ((mod & 6) == 6) {
    //     if (num > 5) acct_delete(num);
    // }
    // else if ((mod & 2) == 2) acct_edit(num);
    // else 
    if (db.accounts[num].subacct == null) db.acct_ledger(num);
    else acct_edit(num, 1);
}

function tran_edit(n) {
    /* Edit a new or existing transaction */
    let a = db.page.split('-');
    a = a.length > 1 ? parseInt(a[1]) : 0;
    let tran = n == null ? {date: LDate.today(), descr: "", data: [[a, 1000], [a, -1000]]} : db.ledger[db.index_of(n)];
    cover("#Tran_New");
    let dlg = $("#Tran_New").attr("data-info", n == null ? -1 : n);
    dlg.find("tbody").html("");
    dlg.find("input[type=date]")[0].valueAsDate = tran.date;
    let data = tran.data;
    for (let r=0; r<data.length; r++) {
        let tr = tran_edit.split();
        let opt = tr.find("select")[0].options;
        for (let j=0;j<opt.length;j++)
            if (opt[j].value == data[r][0]) opt.selectedIndex = j;
        $(tr.children("td")[1]).html(data[r][1] / 100);
    }
    tran_edit.validate(1);
    dlg.find("input[type=text]").val(tran.descr).focus();
}

tran_edit.okay = () => {
    /* Save the transaction */
    let dlg = $("#Tran_New");
    let num = parseInt($("#Tran_New").attr("data-info"));
    let date = new LDate(dlg.find("input[type=date]")[0].valueAsDate).add(true);
    let descr = dlg.find("input[type=text]").val();
    let data = [];
    for (let tr of dlg.find("tbody tr")) {
        tr = $(tr);
        let a = tr.find("select")[0];
        a = parseInt(a.options[a.selectedIndex].value);
        let amt = tr_amt(tr.children("td"));
        if (amt) data.push([a, amt]);
    }
    db.tran_post(date, descr, data, num == -1 ? null : num);
    go_main();
}

let td_amt = td => {
    let amt = parseFloat($(td).text().replaceAll(' ', '').replace('$', ''));
    return isNaN(amt) ? 0 : Math.round(100 * amt);
}

let tr_amt = tds => td_amt(tds[1]) - td_amt(tds[2]);

tran_edit.validate = function() {
    /* Ensure that the transaction is valid */
    let trs = $("#Tran_New tbody tr");
    let set_tr = (tds, amt) => {
        let i = amt < 0 ? 2 : 1;
        $(tds[i]).html(Ledger.money(Math.abs(amt)));
        $(tds[3-i]).html("");
        return amt;
    }
    let deb = 0;
    for (let tr of trs) {
        let tds = $(tr).children("td");
        let amt = tr_amt(tds);
        deb += set_tr(tds, amt);
    }
    if (deb != 0) {
        let tds = $(trs[trs.length - 1]).children("td");
        set_tr(tds, tr_amt(tds) - deb);
    }
}

tran_edit.split = (validate) => {
    /* Add a new split to the transaction */
    let tbl = $("#Tran_New tbody");
    tbl.find("tr > td:not(:nth-child(1))").attr({contenteditable: true});
    tr = $("<tr>").appendTo(tbl);
    let sel = db.select(false);
    tr.append($("<td>").html(sel));
    for (let i=0; i<2; i++)
        tr.append($("<td>").addClass("Right"));
    tr.children("td").on("blur", function() {
        let tds = $(this).closest("tr").children("td");
        let i = 0, j;
        for (let td of tds) {
            if (td == this) j = i;
            i++;
        }
        if ($(this).html().length) $(tds[3 - j]).html("");
        tran_edit.validate();
    });
    if (validate) tran_edit.validate();
    return tr;
}

tran_edit.del = () => {
    if (confirm("This action cannot be undone!\nContinue?")) {
        let num = parseInt($("#Tran_New").attr("data-info"));
        db.del("ledger", num);
        db.ledger.splice(db.index_of(num), 1);
        go_main();
    }
}

function example() {
    db.acct_new("Retained Earnings", 3);

    let n = db.acct_new("Current Assets", 1, 0, 1).number;
    db.acct_new("Chequing", n);
    db.acct_new("Savings", n);
    n = db.acct_new("Fixed Assets", 1, 0, 1).number;
    db.acct_new("Car", n);

    db.acct_new("Investments", 1, 0, 1);

    db.acct_new("Visa", 2);
    db.acct_new("Car Loan", 2);

    db.acct_new("Salary", 4, 0, 1).number;
    db.acct_new("Bank Interest", 4, 0, 1).number;

    n = db.acct_new("Food", 5, 0, 1).number;
    db.acct_new("Groceries", n);
    db.acct_new("Restaurant / Delivery", n);

    n = db.acct_new("Transportation", 5, 0, 1).number;
    db.acct_new("Auto Insurance", n);
    db.acct_new("Gasoline", n);
    db.acct_new("Repair & Maintenance", n);

    n = db.acct_new("Utilities", 5, 0, 1).number;
    db.acct_new("Electricity", n);
    db.acct_new("Natural Gas", n);
    db.acct_new("Internet & TV", n);

    n = db.acct_new("Financial", 5, 0, 1).number;
    db.acct_new("Loan Interest", n);
    db.acct_new("Bank Service Charge", n);

    let data = [
        [10101, 20000],    // Chequing
        [10102, 100000],   // Savings
        [10201, 1200000],  // Car
        [202, -850000],    // Car Loan
        [201, -50000],     // Visa
        [301, -420000]     // Retained earnings
    ]; 
    db.tran_post(new LDate(), "Opening Entry", data);

}

function init(db_name) {

    Ledger.open(db_name).then(async r => {
        db = r;
        db.max_depth = $("#Acct_Depth")[0].options.length - 1;
        let dlg = $("#Dialogs").remove();
        db.dialogs = dlg.children();
        if (init.example && db.length == 5) example();
        db.balance_sheet();

        $(window).on("click", ev => {
            let mod = (ev.shiftKey ? 1 : 0) + (ev.ctrlKey ? 2 : 0) + (ev.altKey ? 4 : 0);
            let target = $(ev.target);

            // Click on account name
            let acct = parseInt(target.attr("data-acct"));
            if (acct) {
                if (mod & 2) acct_edit(acct);
                else click_acct(acct);
            }

            // Click on ledger entry
            try {
                let i = target.closest("tr").attr("data-number");
                if (i) tran_edit(i);
            } catch(err) {}

            // Open date chooser
            if (target.hasClass("Edit_Date")) edit_date();

            // Click on action link
            let key = "data-action";
            let action = target.closest(`[${key}]`).attr(key);
            if (action) {
                let f = init.actions[action];
                if (f) f();
            }
        });
    })
}

init.actions = {go_main: go_main, edit_date: edit_date.okay, menu_btn: () => cover("#Menu"), edit_acct: acct_edit.okay,
    plus_btn: () => tran_edit(), edit_tran: tran_edit.okay, add_split: tran_edit.split, del_tran: tran_edit.del,
};


$(() => {
    /* Choose ledger database */
    let args = new URLSearchParams(location.search);
    let db_name = args.get("db");
    init.example = args.get("example");
    if (db_name) init(db_name);
    else indexedDB.databases().then(dbs => {
        let ul = $("main ul");
        for (let i=0;i<dbs.length;i++) {
            let name = dbs[i].name.split(':');
            if (name.length == 2 && name[0] == Ledger.prefix) {
                ul.append($("<li>").html($("<span>").addClass("Link").html(name[1])));
                databases.push(name[1]);
            }
        }
        if (dbs.length) ul.find("li > span").on("click", ev => {
            let e = $(ev.target);
            let db_name = e.text();
            if (db_name) location.href = location.pathname + `?db=${db_name}`;
        });
        else $(".Also").hide();
    });
});


function delete_all() {
    /* Export ledger as JSON and then delete from browser storage */
    db.json(3);
    if (confirm("Delete all data from browser storage?\n\nJust in case... \nyou should verify that data export was successful first!")) {
        db.close();
        indexedDB.deleteDatabase(Ledger.prefix + ':' + db.name);
        location.href = location.pathname;
    }
}

function renumber(...args) {
    /* Export ledger as JSON after renumering accounts */
    db.json(3, ...args);
}

function import_json() {
    let e = $("#Import_JSON");
    let f = e[0].files[0];
    let reader = new FileReader();
    reader.addEventListener("loadend", () => {
        let data = JSON.parse(reader.result);
        if (data["simple-ledger"]) {
            let db_name = prompt("Ledger Name?", f.name.split('.')[0])
            if (db_name) {
                db_name = db_name.replaceAll(':', '_');
                if (databases.indexOf(db_name) != -1) alert("That ledger name is already in use!");
                else Ledger.open(db_name).then(async r => import_json.load(r, data)).then(() => {
                    location.href = location.pathname + `?db=${db_name}`;
                });
            }
            else alert("File does not appear to contain valid Simple Ledger data!");
        }
    });
    reader.readAsText(f); 
}

function new_ledger(example) {
    let db_name = prompt("Ledger Name?");
    if (db_name) {
        let url = location.pathname + `?db=${db_name.replaceAll(':', '_')}`;
        if (example) url += "&example=1";
        location.href = url;
    }
}

import_json.load = async(db, data) => {
    let accts = data.accounts;
    let acct_list = [];
    for (let a in accts) {
        a = parseInt(a);
        let acct = accts[a];
        acct.number = a;
        acct_list.push(acct);
    }
    let n = 1;
    for (let t of data.ledger) {
        t.date = new LDate(t.date);
        t.number = n++;
    }
    let p1 = db.put("accounts", 1, ...acct_list);
    let p2 = db.put("ledger", 1, ...data.ledger);
    await p1;
    return p2;
}
