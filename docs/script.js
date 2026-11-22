

let db;

function cover(dialog) {
    let cover = $("#Cover, #PopUp");
    if (dialog === false) {
        $("#PopUp > *").appendTo("#Dialogs");
        cover.hide();
    }
    else {
        cover.show();
        if (dialog) {
            $("#PopUp").html($(dialog));
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

function acct_delete(acct) {
    console.log("Delete", acct);
}

function acct_edit(acct) {
    console.log("Edit", acct);
}

function acct_new(acct) {
    console.log("New", acct);
}

function click_acct(num, mod) {
    if ((mod & 6) == 6) {
        if (num > 5) acct_delete(num);
    }
    else if ((mod & 2) == 2) acct_edit(num);
    else if (db.accounts[num].subacct == null) db.acct_ledger(num);
    else acct_new(num);
}


function tran_edit(n) {
    /* Edit a new or existing transaction */
    let tran = n == null ? {date: LDate.today(), descr: "", data: [[null, 1000], [null, -1000]]} : db.ledger[db.index_of(n)];
    cover("#Tran_New");
    let dlg = $("#Tran_New");
    dlg.find("tbody").html("");
    dlg.find("input[type=number]").val(n == null ? -1 : n);
    dlg.find("input[type=date]")[0].valueAsDate = tran.date;
    let data = tran.data;
    for (let r=0; r<data.length; r++) {
        let tr = tran_edit.split();
        let opt = tr.find("select")[0].options;
        for (let j=0;j<opt.length;j++)
            if (opt[j].value == data[r][0]) opt.selectedIndex = j;
        $(tr.children("td")[1]).html(data[r][1] / 100);
    }
    tran_edit.validate();
    dlg.find("input[type=text]").val(tran.descr).focus();
}

tran_edit.okay = () => {
    /* Save the transaction */
    let dlg = $("#Tran_New");
    let num = parseInt(dlg.find("input[type=number]").val());
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
    let amt = parseFloat($(td).text().replace('$', ''));
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

tran_edit.split = () => {
    /* Add a new split to the transaction */
    let tbl = $("#Tran_New tbody");
    tr = $("<tr>").appendTo(tbl);
    let sel = db.select(false);
    tr.append($("<td>").html(sel));
    for (let i=0; i<2; i++)
        tr.append($("<td>").addClass("Right").attr({contenteditable: true}));
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
    tran_edit.validate();
    return tr;
}

tran_edit.del = () => {
    if (confirm("This action cannot be undone!\nContinue?")) {
        let num = parseInt($("#Tran_New input[type=number]").val());
        db.del("ledger", num);
        db.ledger.splice(db.index_of(num), 1);
        go_main();
    }
}

let menu = () => console.log("menu");


function example() {
    let n = db.acct_new("Current Assets", 1, 0, 1).number;
    db.acct_new("Chequing", n);
    db.acct_new("Savings", n);
    db.acct_new("Visa", 2);
    
    n = db.acct_new("Food", 5, 0, 1).number;
    db.acct_new("Groceries", n);
    db.acct_new("Restaurant / Delivery", n);

    db.tran_post("2026.11.4", "Safeway", [[50101, 3750], [201, -3750]]);
    db.tran_post("2026.11.1", "BP's", [[50102, 5200], [201, -5200]]);

    db.tran_post("2026.1.1", "Opening Entry", [
        [201, -50000],     // Visa
        [10101, 20000],    // Chequing
        [10102, 100000],   // Savings
        [301, -70000]      // Retained earnings
    ]);

}

function init(db_name) {

    Ledger.open(db_name).then(async r => {
        db = r;
        db.dialogs = $("#Dialogs > *");
        // example();

        db.balance_sheet();

        $(window).on("click", ev => {
            let mod = (ev.shiftKey ? 1 : 0) + (ev.ctrlKey ? 2 : 0) + (ev.altKey ? 4 : 0);
            let target = $(ev.target);

            // Click on account name
            let acct = target.attr("data-acct");
            if (acct) click_acct(parseInt(acct), mod);

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
        }).on("keydown", ev => {
            if (ev.ctrlKey && ev.altKey) {
                let key = ev.originalEvent.key.toLowerCase();
                let main = $("main");
                if (key == 'b') main.toggleClass("NoBefore");
                else if (key == 'a') main.toggleClass("NoAfter");
                else if (key == 's') main.removeClass("NoAfter NoBefore");
                else if (key == 'h') main.addClass("NoAfter NoBefore");
            }
        });
    })
}

init.actions = {go_main: go_main, edit_date: edit_date.okay, menu_btn: menu,
    plus_btn: () => tran_edit(), edit_tran: tran_edit.okay, add_split: tran_edit.split, del_tran: tran_edit.del};


$(() => {
    /* Choose ledger database */
    let db_name = new URLSearchParams(location.search).get("db");
    if (db_name) init(db_name);
    else indexedDB.databases().then(dbs => {
        let ul = $("main ul");
        for (let i=0;i<dbs.length;i++) {
            let name = dbs[i].name.split(':');
            if (name.length == 2 && name[0] == Ledger.prefix)
                ul.append($("<li>").html($("<span>").addClass("Link").html(name[1])));
        }
        ul.append($("<li>").html($("<span>").addClass("Link New_DB").html("[New Ledger]")));
        ul.find("li > span").on("click", ev => {
            let e = $(ev.target);
            let db_name = e.hasClass("New_DB") ? prompt("Ledger Name?").replaceAll(':', '_') : e.text();
            if (db_name) location.href = location.pathname + `?db=${db_name}`;
        });
    });
});


function delete_all() {
    /* Export ledger as JSON and then delete from browser storage */
    if (confirm("Export and then delete all data?")) {
        db.json(3);
        db.close();
        indexedDB.deleteDatabase(Ledger.prefix + ':' + db.name);
        location.href = location.pathname;
    }
}

function renumber(...args) {
    /* Export ledger as JSON after renumering accounts */
    db.json(3, ...args);
}
