/***  Global variables ***/

let acct = {}, ledger = [], tree, balances, open_date;


/*** Helper functions ***/

function safe_str(s) {
    return s.replaceAll(',', '_').replaceAll('*', '_');
}

function money(amt) {
    let s = $("<span>");
    if (amt || money.zero) {
        let val = (Math.abs(amt) / 100).toFixed(2);
        if (amt < 0) s.addClass("Red").html(`($${val})`);
        else s.html('$' + val);
    }
    return s;
}

money.zero = true;

function show(n) {
    if (n == null) n = $("#IncomeStatement").is(":visible") ? 0 : 1
    if (n == 0) income_statement();
    else if (n == 1) balance_sheet();
    $($("article").hide()[n]).show();
    let [d, b] = [$("#Dates"), $("#NewBtn").closest("div")];
    if (n < 2) {d.show(); b.hide()}
    else {d.hide(); b.show()}
}


/*** Date ***/

function date_str(time, d) {
    if (!d) d = new Date();
    let two = n => n < 10 ? `0${n}` : `${n}`;
    let s = `${d.getFullYear()}.${two(d.getMonth()+1)}.${two(d.getDate())}`;
    if (time) s += `-${two(d.getHours())}.${two(d.getMinutes())}.${two(d.getSeconds())}`;
    return s;
}

date_str.month = (when, d) => {
    d = date_str(d).split('.');
    let i = parseInt;
    return when == -1 ? `${d[0]}.${d[1]}.01` : date_str(0, new Date(i(d[0]), i(d[1]), 0));
}

function get_date(sel) {
    return new Date($(sel).val().replaceAll("-", '.'));
}


/*** Account tree ***/

function acct_tree() {
    tree = {1: {}, 2: {}, 3: {}, 4: {}, 5: {}};
    for (let i in tree) sub_acct(tree, i);
}

function sub_acct(obj, par) {
    let sub = obj[par];
    for (let a in acct) {
        let p = acct[a][1];
        if (p == par) sub[a] = {};
    }
    for (let s in sub) sub_acct(sub, s);
}


/*** Account info ***/

function path(n) {
    n = parseInt(n);
    let p = [n];
    while (n) {
        let a = acct[n];
        if (a) {
            n = a[1]
            p.push(n);
        }
        else n = null;
    }
    p.reverse();
    return p;
}

function parent(a) {
    let p = path(a);
    return p[p.length - 2];
}

function children(n) {
    let child = [];
    for (let c in acct) {
        if (acct[c][1] == n) child.push(parseInt(c));
    }
    return child;
}

function is_place_holder(a) {return acct[a].length < 3}
function is_debit(a) {return path(a)[0] < 3}

function short_name(n) {
    return n > 5 ? acct[n][0] : ["Assets", "Expenses", "Liabilities", "Income", "Equity"][n - 1];
} 

function full_name(a) {
    let f = "";
    for (let p of path(a)) {
        if (f.length) f += " : "
        f += short_name(p);
    }
    return f;
}

function can_delete(a) {
    if (is_place_holder(a)) return children(a).length == 0;
    for (let t of ledger) for (let [n, v] of t.data) {
        if (n == a) return false;
    }
    return true;
}

function edit_acct(a, is_new) {
    let p = a, ph;
    if (is_new) {
        a = a < 100 ? 100 * a : a + 1;
        while (acct[a] != null) a++;
        ph = false;
    }
    else {
        p = parent(a);
        ph = is_place_holder(a);
    }
    let max = path(p).length >= print_accts.maxlevels;
    $("#EditType").html(is_new ? "New" : "Edit");
    edit_acct.nums = [a, p];
    let sel = acct_select(false);
    $("#ParentAcct").html(sel);
    acct_select.set_val(sel, p);
    $("#AcctName").val(is_new ? "" : acct[a][0]);
    $("#OpenBal").val(is_new || ph ? 0 : Math.round(acct[a][2] / 100, 2));
    let check = $("#PH")[0];
    check.checked = is_new || max ? false : ph;
    check.disabled = !is_new || max;
    edit_acct.toggle(check);
    $("#Cover, #NewAcct ").show();
}

edit_acct.toggle = e => {
    /* Toggle placeholder account checkbox */
    let div = $("#OpenBal").closest("div");
    if (e.checked) div.hide();
    else div.show();

}

edit_acct.button = btn => {
    $("#Cover, #NewAcct ").hide();
    if (btn) {
        let [a, p] = edit_acct.nums;
        let aname = safe_str($("#AcctName").val());
        if (aname.length == 0) aname = "Unnamed";
        let par = $("#ParentAcct").find("select")[0].options;
        par = parseInt(par[par.selectedIndex].value);
        if (par == a) par = p;
        let data = [aname, par];
        let has_bal = !$("#PH")[0].checked;
        if (has_bal) data.push(Math.round(100 * parseFloat($("#OpenBal").val())));
        acct[a] = data;
        acct_tree();
        if (has_bal && !is_debit(a)) data[2] *= -1;
        calc_bal();
        show();
    }
}

function acct_select(filter) {
    /* Create a <select> with the account list */
    let list = filter === false ? [[1], [3], [4], [2], [5]] : [[], [], [], [], []];
    if (filter == null) filter = a => !is_place_holder(a);
    else if (filter === false) filter = a => is_place_holder(a);
    else if (filter === true) filter = a => true;
    for (let a in acct) if (filter(a)) {
        list[path(a)[0] - 1].push(parseInt(a));
    }
    for (let l of list) {
        l.sort((a, b) => {
            a = full_name(a).toUpperCase();
            b = full_name(b).toUpperCase();
            return a < b ? -1 : 1;
        });
    }
    list = [...list[0], ...list[2], ...list[3], ...list[1], ...list[4]];
    let sel = $("<select>");
    for (let a of list) sel.append($("<option>").attr("value", a).html(full_name(a)));
    return sel.appendTo("body");
}

acct_select.set_val = (sel, a) => {
    /*** Set selectedIndex by matching <option> value attribute***/
    let opt = $(sel)[0].options;
    for (let i=0; i<opt.length; i++) {
        if (opt[i].value == a) opt.selectedIndex = i;
    }
    return opt.selectedIndex;
}

/*** Balance calculation ***/

function calc_bal(unmodified) {
    if (!unmodified) $("nav").addClass("Modified");
    let start = get_date("#DateStart");
    let end = get_date("#DateEnd");
    calc_bal.dates = [start, end];
    balances = {};
    for (let a in acct) {
        let data = acct[a];
        let bal = data[2];
        if (bal != null) {
            for (let t of ledger) {
                let tdate = new Date(t.date);
                if (tdate <= end && (tdate >= start || path(a)[0] % 2)) {
                    for (let [n, v] of t.data) if (n == a) bal += v;
                }
            }
            balances[a] = bal;
        }
    }
    return balances;
}

function bal(n) {
    if (balances[n] != null) return balances[n];
    else {
        let b = 0;
        for (let a of children(n)) b += bal(a);
        return b;
    }
}


/*** Income Statement and Balance Sheet ***/

function print_accts(e, accts, level, neg) {
    if (level >= print_accts.levels) return;
    for (let a in accts) {
        let s = $("<span>").html(short_name(a));
        // if (path(a)[0] != 5) {
            let [cls, title] = is_place_holder(a) ? ["NewAcct", "New Sub-Account [Click] or Edit Account [Ctrl+Click]"] :
                ["AcctLink", "Open Ledger [Click] or Edit Account [Ctrl+Click]"];
            // if (cls == "AcctLink" || path(a).length <= print_accts.maxlevels)
                s.addClass(cls).attr({"data-acct": a, title: title});
        // }
        e.append($("<p>").addClass(`Level${level}`).html(s).append(money(bal(a) * (neg ? -1 : 1)).addClass("Right")));
        print_accts(e, accts[a], level + 1, neg);
    }
}

print_accts.maxlevels = 6;
print_accts.levels = print_accts.maxlevels;

function income_statement() {
    let attr = {title: "New Sub-Account", "data-acct": 4};
    let amt = [-bal(4), bal(2)];
    let inc = $("<section>").append($("<h2>").html($("<span>").html("Income").addClass("NewAcct").attr(attr)));
    print_accts(inc, tree[4], 0, true);
    inc.append($("<p>").addClass("Subtotal").html("Total Income").append(money(amt[0]).addClass("Right")));

    attr["data-acct"] = 2;
    let exp = $("<section>").append($("<h2>").html($("<span>").html("Expenses").addClass("NewAcct").attr(attr)));
    print_accts(exp, tree[2], 0);
    exp.append($("<p>").addClass("Subtotal").html("Total Expenses").append(money(amt[1]).addClass("Right")));

    let e = $("#IncomeStatement").html($("<h1>").html("Income Statement"));
    e.append(inc).append(exp);
    e.append($("<p>").addClass("Total").html("Net Income").append(money(amt[0] - amt[1]).addClass("Right")));
}

function balance_sheet() {
    let attr = {title: "New Sub-Account", "data-acct": 1};
    let amt = [bal(1), -bal(3), -bal(5)];
    
    let asset = $("<section>").append($("<h2>").html($("<span>").html("Assets").addClass("NewAcct").attr(attr)));
    print_accts(asset, tree[1], 0);
    asset.append($("<p>").addClass("Subtotal").html("Total Assets").append(money(amt[0]).addClass("Right")));

    attr["data-acct"] = 3;
    let liab = $("<section>").append($("<h2>").html($("<span>").html("Liabilities").addClass("NewAcct").attr(attr)));
    print_accts(liab, tree[3], 0, true);
    liab.append($("<p>").addClass("Subtotal").html("Total Liabilities").append(money(amt[1]).addClass("Right")));

    amt_eq = amt[0] - amt[1];
    amt_net = -bal(4) - bal(2);
    amt_re = amt_eq - amt[2] - amt_net;

    attr["data-acct"] = 5;
    let eq = $("<section>").append($("<h2>").html($("<span>").html("Equity").addClass("NewAcct").attr(attr)));
    eq.append($("<p>").html("Net Income").append(money(amt_net).addClass("Right")));
    print_accts(eq, tree[5], 0, true);
    if (amt_re) eq.append($("<p>").html("Retained Earnings").append(money(amt_re).addClass("Right")));
    eq.append($("<p>").addClass("Subtotal").html("Total Equity").append(money(amt_eq).addClass("Right")));

    let e = $("#BalanceSheet").html($("<h1>").html("Balance Sheet"));
    e.append(asset).append(liab).append(eq);
}


/*** Account Ledger ***/

function acct_ledger(a) {
    if (a == null) a = acct_ledger.acct;
    else acct_ledger.acct = a = parseInt(a);
    let cred = is_debit(a) ? 1 : -1;
    let list = [];
    for (let num in ledger) {
        num = parseInt(num);
        let t = ledger[num];
        for (let n of t.data) if (n[0] == a) {
            let data = {...t};
            data.index = num;
            data.date = new Date(data.date);
            list.push(data);
        }
    }
    list.sort((a, b) => {
        a = a.date; b = b.date;
        return a == b ? 0 : (a < b ? -1 : 1);
    });
    list.splice(0, 0, {date: new Date(open_date), descr: "Opening Balance", data: [[a, acct[a][2]]]});
    let e = $("#Ledger").html("").append($("<h2>").html(full_name(a)));
    let td = (h, c) => $(c ? "<th>" : "<td>").html(h);
    let tr = $("<tr>");
    for (let h of ["Date", "Description", "Amount", "Balance"]) tr.append(td(h, 1));
    let tbl = $("<table>").appendTo(e).html($("<thead>").html(tr));
    tbl = $("<tbody>").appendTo(tbl);
    let bal = 0;
    for (let t of list) {
        let tr = $("<tr>").appendTo(tbl).attr("data-index", t.index);
        tr.append($("<td>").html(date_str(0, t.date)));
        tr.append($("<td>").html(t.descr));
        let amt = 0;
        for (let data of t.data) {
            if (data[0] == a) amt += data[1];
        }
        bal += amt;
        tr.append($("<td>").html(money(amt * cred)));
        tr.append($("<td>").html(money(bal * cred)));
    }
    show(2);
}

function transaction(date, descr, ...args) {
    let t = {date: date, descr: descr, data: [...args]};
    for (let i=0;i<t.data.length;i++) {
        if (typeof(t.data[i]) == "string") {
            let [n, v] = t.data[i].split(";");
            t.data[i] = [parseInt(n), parseInt(v)];
        }
    }
    return t;
}

function edit_transaction(i) {
    edit_transaction.index = i;
    let t = i === false ? transaction(date_str(), "Description", [acct_ledger.acct, 0], [acct_ledger.acct, 0]) : ledger[i];
    $("#TrDate")[0].valueAsDate = new Date(t.date);
    $("#TrDescr").val(t.descr);
    $("#EditTr tbody").html("");
    for (let [a, amt] of t.data) edit_transaction.split(a, amt);
    edit_transaction.balance();
    $("#Cover, #EditTr").show();
}

edit_transaction.split = (a, amt) => {
    /* Add a new split to the transaction editor */
    let tbl = $("#EditTr tbody");
    let tr = $("<tr>").appendTo(tbl);
    let td = $("<td>").appendTo(tr);
    let sel = acct_select().appendTo(td);
    acct_select.set_val(sel, a);
    let tdx = h => {
        let td = $("<td>").html(h).addClass("Amount").attr("contenteditable", "true");
        return td.on("blur", edit_transaction.blur_amt).appendTo(tr);
    }
    tdx(amt > 0 ? money(amt) : "");
    tdx(amt < 0 ? money(-amt) : "");
} 

edit_transaction.blur_amt = ev => {
    /* Handler for blur event when entering credit or debit amount */
    let td = $(ev.currentTarget);
    let tds = td.closest("tr").children();
    let col = tds.index(td[0]);
    if ($(tds[col]).text().length) $(tds[3 - col]).html("");
    edit_transaction.balance();
}

edit_transaction.get_amt = td => {
    let amt = Math.round(100 * parseFloat($(td).text().replace('$', '')));
    return isNaN(amt) ? 0 : amt;
}

edit_transaction.balance = () => {
    /* Validate transaction data */
    let trs = $("#EditTr tbody tr");
    let imbal = 0;
    let get_amt = edit_transaction.get_amt;
    let set_amt = (tr, amt) => {
        tr = $(tr);
        let tds = tr.children("td");
        if (amt == null) amt = get_amt(tds[1]) - get_amt(tds[2]);
        $(tds[1]).html(amt < 0 ? "" : money(amt));
        $(tds[2]).html(amt < 0 ? money(-amt) : "");
        return amt;
    }
    for (let tr of trs) imbal += set_amt($(tr));
    if (imbal) {
        let tr = $(trs[trs.length - 1]);
        let tds = tr.children("td");
        let deb = get_amt(tds[1]) - get_amt(tds[2]);
        set_amt(tr, deb - imbal);
    }
}

edit_transaction.button = b => {
    /* Handle button clicks from the Edit Transaction dialog*/
    if (b == 2) { // Add split
        edit_transaction.split(acct_ledger.acct, 0);
        edit_transaction.balance();
    }
    else {
        if (b == 1) { // Save
            let get_amt = edit_transaction.get_amt;
            let trs = $("#EditTr tbody tr");
            let data = [];
            for (let tr of trs) {
                let tds = $(tr).children("td");
                let amt = get_amt(tds[1]) - get_amt(tds[2]);
                let opt = $(tds[0]).children("select")[0].options;
                let i = opt.selectedIndex;
                if (amt) data.push([parseInt(opt[i].value), amt]);
            }
            let date = get_date("#TrDate");
            let descr = $("#TrDescr").val();
            let tr = {date: date, descr: descr, data: data}
            let i = edit_transaction.index;
            if (i === false) ledger.push(tr);
            else ledger[i] = tr;
        }
        else if (b == 3)  // Delete
            ledger.splice(edit_transaction.index, 1);
        calc_bal();
        acct_ledger();
        $("#Cover, #EditTr ").hide();
    }
}


/*** Settings dialog ***/

function settings() {
    $("#ReportLevel")[0].options.selectedIndex = print_accts.levels - 1;
    $("#OpenDate")[0].valueAsDate = new Date(open_date);
    $("#Cover, #Settings").show();
}

settings.button = () => {
    print_accts.levels = $("#ReportLevel")[0].options.selectedIndex + 1;
    let date = date_str(0, get_date("#OpenDate"));
    if (date != open_date) {
        open_date = date;
        calc_bal();
    }
    show();
    $("#Cover, #Settings ").hide();
}


/*** Import ***/

function import_data(t) {
    t = t.split("****");
    open_date = t[2].trim();
    for (let e of t[0].trim().split("\n")) {
        e = e.trim().split(",");
        if (e.length > 2) {
            let [n, d, p, b] = e;
            n = acct[parseInt(n)] = [d, parseInt(p)];
            if (b != null) n.push(parseInt(b));
        }
    }
    acct_tree();
    for (let e of t[1].trim().split("\n")) {
        e = e.trim().split(",");
        if (e.length > 3) {
            ledger.push(transaction(...e));
        }
    }
}


/*** Export ***/

function export_data() {
    if (!$("nav").hasClass("Modified")) return;
    let csv = "";
    for (let a in acct) {
        csv += `${a}`;
        for (x of acct[a]) csv += `,${x}`;
        csv += "\n";
    }
    csv += "****\n";
    for (t of ledger) {
        csv += `${t.date},${t.descr}`;
        for (let [a,x] of t.data) csv += `,${a};${x}`;
        csv += "\n";
    }
    csv += `****\n${open_date}`;
    let url = URL.createObjectURL(new Blob([csv], {"type": "text/csv"}));
    $("<a>").attr({href: url, download: `${open_file.fname}-${date_str(1)}.csv`})[0].click();
    URL.revokeObjectURL(url);
    $("nav").removeClass("Modified");
}

function inc_st_click(ev) {
    if (ev.ctrlKey && ev.altKey) {
        let modified = $("nav").hasClass("Modified");
        if (modified) alert("Save changes before proceeding!");
        else if (confirm(`Save balances as of ${date_str(0, get_date("#DateEnd"))}?`)) {
            console.log(acct);
            for (let a in balances) {
                let t = path(a)[0];
                acct[a][2] = t == 2 || t == 4 ? 0 : balances[a];
            }
            ledger = [];
            calc_bal();
            alert("Ledger has been cleared!");
        }
    }
    show(0);
}


/*** Open ***/

$(() => {
    $("nav").hide();
    show(3);
});

function open_file(fn) {
    let reader = new FileReader();
    reader.addEventListener("loadend", () => init(reader.result));
    open_file.fname = fn.files[0].name.split('.')[0].split('-')[0];
    reader.readAsText(fn.files[0]); 
}

open_file.fname = "ledger";

function init(csv) {
    $("#DateStart")[0].valueAsDate = new Date(date_str.month(-1));
    $("#DateEnd")[0].valueAsDate = new Date(date_str.month(0));
    if (!csv) csv = init.data + date_str();
    import_data(csv);
    $("nav").show();
    calc_bal(1);
    show(0);
}

init.data = `100,Current Assets,1
101,Fixed Assets,1
102,Investment,1
200,Financial,2
201,Food,2
202,Utilities,2
300,Credit Cards,3
400,Taxable,4
401,Non-Taxable,4
1001,Chequing Account,100,0
1002,Savings Account,100,0
1021,RRSP,102
2001,Home Insurance,200,0
2002,Bank Interest,200,0
2003,Bank Service Charge,200,0
2011,Groceries,201,0
2012,Restaurant / Delivery,201,0
2021,Electricity,202,0
2022,Natural Gas,202,0
2023,Telecom,202,0
3001,Visa,300,0
4001,Salary,400,0
4002,Bank Interest,400,0
4011,RRSP Income,401
40111,GIC Interest,4011
****
****
`;


/*** Event handlers ***/

$(window).on("click", ev => {
    let e = $(ev.target);
    let a = e.attr("data-acct");
    if (a) {
        if (ev.altKey && ev.ctrlKey) {
            if (can_delete(a)) {
                if (confirm("Account will be permanently deleted! Continue?")) {
                    delete acct[a];
                    acct_tree();
                    calc_bal();
                    show();
                }
            }
            else alert("This account cannot be deleted!");
        }
        else if (e.hasClass("AcctLink")) {
            if (ev.ctrlKey) edit_acct(a);
            else acct_ledger(a);
        }
        else if (e.hasClass("NewAcct")) edit_acct(a, !ev.ctrlKey);
    }
    a = e.closest("tr[data-index]").attr("data-index");
    if (a) {
        a = parseInt(a);
        if (ev.ctrlKey) {
            if (confirm("This will permanently delete the transaction!")) {
                ledger.splice(a, 1);
                calc_bal();
                acct_ledger();
            }
        }
        else edit_transaction(a);
    }
});
