/**
 * transactions.js is part of Wallace Point of Sale system (WPOS)
 *
 * transactions.js Provides functions to view and manage past transactions, as well as UI functionality for refunds/voids.
 *
 * WallacePOS is free software; you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation; either
 * version 3.0 of the License, or (at your option) any later version.
 *
 * WallacePOS is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the GNU
 * Lesser General Public License for more details:
 * <https://www.gnu.org/licenses/lgpl.html>
 *
 * @package    wpos
 * @copyright  Copyright (c) 2014 WallaceIT. (https://wallaceit.com.au)
 * @author     Michael B Wallace <micwallace@gmx.com>
 * @since      Class created 15/1/13 12:01 PM
 */
var datatable;
function WPOSTransactions() {

    var transdialog = $("#transactiondiv");
    var creditdialog = $("#creditpaymentsdiv");
    var creditpaymentdialog = $("#creditpaymentstable");
    var paymentMethods = ['bank', 'cash', 'mpesa'];
    var sale = {};
    var curcredit = 0;

    this.showTransactionView = function () {
        $("#main-content").tabs("option", "active", 1);
        this.setupTransactionView();
    };

    this.setupTransactionView = function(){
        loadLocalTransactions();
        datatable.api().responsive.recalc();
    };

    this.showTransactionInfo = function(ref){
        populateTransactionInfo(ref);
        transdialog.dialog('open');
        repositionDialog();
    };

    this.showPaymentDialog = function(ref) {
        // Show integrated eftpos button if enabled
        sale = getSale('"'+ref+'"');
        var inteftbtn = $("#eftpospaybtn");
        if (WPOS.hasOwnProperty('eftpos') && WPOS.eftpos.isEnabledAndReady()){
          inteftbtn.show();
          inteftbtn.text(WPOS.util.capFirstLetter(WPOS.eftpos.getType())+' Bank');
        } else {
          inteftbtn.hide();
        }
        creditdialog.dialog('open');
        curcredit = getCredit(sale.payments);
        $("#credit").text(WPOS.util.currencyFormat(curcredit));
        $("#endcreditbtn").prop("disabled", false); // make sure the damn button is active, dunno why but when the page reloads it seems to keep its state.
    };

    this.addPayment = function(method){
      addPaymentRow(method, curcredit, curcredit, null);
      WPOS.sales.updatePaymentSums();
    };

    function addPaymentRow(method, value, tender, change, extraData){
      var exmethod = '';
      if ($.inArray(method, paymentMethods)==-1)
        exmethod = '<option value="'+method+'" selected>'+method+'</option>';
      var data = '';
      if (extraData)
        data = "data-paydata='"+JSON.stringify(extraData)+"'";

      var curBefore = "", curAfter = "";
      if (WPOS.util.getCurrencyPlacedAfter()){
        curAfter = WPOS.util.getCurrencySymbol();
      } else {
        curBefore = WPOS.util.getCurrencySymbol();
      }

      var payrow =  '<tr '+data+'><td>' +
        '<select class="paymethod form-control" style="max-width:150px;" onchange="WPOS.sales.onPaymentMethodChange(this);">' +
        '<option value="eftpos" '+(method=='eftpos'?'selected':'')+'>Bank</option>' +
        '<option value="cash" '+(method=='cash'?'selected':'')+'>Cash</option>' +
        '<option value="mpesa" '+(method=='mpesa'?'selected':'')+'>Mpesa</option>' +
        exmethod+ '</select>' +
        '<div class="cashvals" '+(method!='cash'?'style="display: none"':'width:150px;')+'>' +
        '<div style="margin:5px 0px;">Tendered:</div> <input onChange="WPOS.sales.updatePaymentChange($(this).parent());" class="paytender numpad form-control" style="width:80px;display:inline;" type="text" value="'+(method!='cash'?0.00:(tender!=null?tender:value))+'" />' +
        '<div style="margin:5px 0px;">Change:</div> <input class="paychange form-control" style="width:80px;display:inline;" type="text" value="'+(method!='cash'?0.00:(change!=null?change:0.00))+'" readonly />' +
        '</div>'+
        '<div class="mpesa" '+(method!=='mpesa'?'style="display: none"':'width:150px;')+'>'+
        '<div style="font-weight:bold"><h3>M-Pesa Code:<h3></div><input class="mpesa-code form-control" style="display:inline;" type="text" value=""/>' +
        '</div></td>' +
        '<td>'+curBefore+'<input type="hidden" class="method" value="'+method+'"/><input onChange="WPOS.sales.updatePaymentSums();" class="payamount numpad form-control" style="width:80px;display:inline;" type="text" value="'+value+'" autocomplete="off"/> '+curAfter+'</td>' +
        '<td><button class="btn btn-xs btn-danger" onclick="WPOS.sales.removePayment($(this));">X</button></td></tr>';

      creditpaymentdialog.append(payrow);

      // reinitialize keypad & field listeners
      WPOS.initKeypad();
    }


    function getSale(ref) {
        var sales = transtable;
        for (var sale in sales) {
            if (JSON.stringify(sales[sale].ref) === ref) {
                return sales[sale];
            }
        }
    }

    function getCredit(payments) {
        var credit = 0;
        for(var i=0;i<payments.length;i++) {
            if (payments[i].method === "credit") {
                credit += parseFloat(payments[i].amount);
            }
        }
        return credit;
    }

    this.processSale = function () {
        var salebtn = $("#endcreditbtn");
        salebtn.prop("disabled", true);
        if (!validatePayments()){
          salebtn.prop("disabled", false);
          return;
        }
        ProcessSaleTransaction();
        salebtn.prop("disabled", false);
    };

    function validatePayments(){
        var valid = true;
        creditpaymentdialog.children("tr").each(function (index, element) {
          // Make sure payments are positive amounts, except cashout
            if (parseFloat($(element).find(".payamount").val())<0){
                if ($(element).find(".payamount").val()=='cash' && !$(element).data('paydata').hasOwnProperty('cashOut')) {
                    valid = false;
                    swal({
                        type: 'error',
                        title: 'Oops...',
                        text: 'Only cash-out payments may have a negative amount'
                    });
                }
            }
            if ($(element).find(".method").val() === 'mpesa'){
                if (!$(element).find(".mpesa-code").val()){
                    valid = false;
                    swal({
                        type: 'error',
                        title: 'Oops...',
                        text: 'Please add the M-pesa transaction code before continuing'
                    });
                }
            }
        });
        return valid;
    }

    function ProcessSaleTransaction() {
        // gather payments
        var payments = [];
        var paymenttotal = 0;
        creditpaymentdialog.children("tr").each(function (index, element) {
            paymenttotal += parseFloat($(element).find(".payamount").val());
            var payment = {"method": $(element).find(".paymethod option:selected").val(), "amount": parseFloat($(element).find(".payamount").val()).toFixed(2)};
            if (payment.method === 'cash'){
              payment.tender = parseFloat($(element).find(".paytender").val()).toFixed(2);
              payment.change = parseFloat($(element).find(".paychange").val()).toFixed(2);
            }
            if ($(element).data('paydata')){
              payment.paydata = $(element).data('paydata');
            }
            if (payment.method === 'mpesa') {
                payment.transactionCode = $(element).find('.mpesa-code').val();
            }
            payments.push(payment);
        });
        if (paymenttotal <= 0) {
            swal({
                type: 'error',
                title: 'Oops...',
                text: 'Please balance the amount'
              });
              

            return;
        }
        // Check if credit is complete
        if (paymenttotal <= curcredit) {
          for(var i in payments) {
            sale.payments.push(payments[i]);
          }
        }
        curcredit -= paymenttotal;
        var index = -1;
        for(var i in sale.payments) {
          if (sale.payments[i].id !== null) {

          }
          if (sale.payments[i].method === 'credit') {
              sale.payments[i].amount = curcredit;
          }
          if (sale.payments[i].method === "credit" && sale.payments[i].amount == 0)
              index = i;
        }
        if(index !== -1) {
          sale.payments.splice(index, 1);
        }
        updateSalePayments();
        creditpaymentdialog.html('');
        creditdialog.dialog('close');
        transdialog.dialog('close');
        WPOS.trans.setupTransactionView();
    }

    function repositionDialog(){
        transdialog.dialog({
            position: { 'my': 'center', 'at': 'center' }
        });
    }

    this.recallLastTransaction = function(){
        var lastref = WPOS.sales.getLastRef();
        if (lastref == null){
            swal({
                type: 'error',
                title: 'Oops...',
                text: 'No transactions yet for this session.'
              });
              
            return;
        }
        WPOS.trans.showTransactionInfo(lastref);
        transdialog.dialog('open');
    };

    var tableData = [];

    datatable = $('#transactiontable').dataTable(
        {
            "bProcessing": true,
            "aaData": tableData,
            "aaSorting": [[ 5, "desc" ]],
            "aoColumns": [
                { "sType": "string", "mData":function(data, type, val){ return getOfflineStatusHtml(data.ref) + (data.hasOwnProperty('id') ? "<br/>" + data.id : '');} },
                { "sType": "numeric", "mData":function(data, type, val){ return '<a class="reflabel" title="'+data.ref+'" href="">'+data.ref.split("-")[2]+'</a>'; } },
                { "sType": "string", "mData":function(data, type, val){ return getDeviceLocationText(data.devid, data.locid); } },
                { "sType": "numeric", "mData":"numitems" },
                { "sType": "currency", "mData":function(data,type,val){return WPOS.util.currencyFormat(data["total"]);} },
                { "sType": "timestamp", "mData":function(data, type, val){return datatableTimestampRender(type, data.processdt, WPOS.util.getDateFromTimestamp);} },
                { "sType": "html", "mData":function(data,type,val){return getStatusHtml(getTransactionStatus(data.ref));} },
                { "sType": "html", mData:function(data,type,val){ return "<button class='btn btn-sm btn-primary' onclick='WPOS.trans.showTransactionInfo("+"\""+data.ref+"\""+")'>View</button>"; }, "bSortable": false }
            ],
            "columns": [
                {},
                {},
                {},
                {},
                {},
                {},
                {},
                { "width": "52px" }
            ]
        }
    );

    function loadIntoTable(sales){
        tableData = [];
        for (var key in sales){
            tableData.push(sales[key]);
        }
        datatable.fnClearTable(false);
        datatable.fnAddData(tableData, false);
        datatable.api().draw(false);
    }

    function getDeviceLocationText(deviceid, locationid){
        var text = "";
        text += WPOS.getConfigTable().devices.hasOwnProperty(deviceid) ? WPOS.getConfigTable().devices[deviceid].name : "Unknown";
        text += " / " + (WPOS.getConfigTable().locations.hasOwnProperty(locationid) ? WPOS.getConfigTable().locations[locationid].name : "Unknown");
        return text;
    }

    function getOfflineStatusHtml(ref){
        var syncstat;
        if (WPOS.sales.getOfflineSales().hasOwnProperty(ref)){
            if (WPOS.sales.getOfflineSales()[ref].hasOwnProperty("id")){
                syncstat = 2;
            } else {
                syncstat = 1;
            }
        } else {
            syncstat = 3;
        }
        var ostathtml;
        switch (syncstat){
            case 1:
                ostathtml = '<span class="label label-sm label-warning arrowed">offline</span>';
                break;
            case 2:
                ostathtml = '<span class="label label-sm label-warning arrowed">partial</span>';
                break;
            case 3:
                ostathtml = '<span class="label label-sm label-primary arrowed">synced</span>';
                break;
        }
        return ostathtml;
    }

    function getStatusHtml(status){
        var stathtml;
        switch(status){
            case 0:
                stathtml='<span class="label label-primary arrowed">Order</span>';
                break;
            case 1:
                stathtml='<span class="label label-success arrowed">Complete</span>';
                break;
            case 2:
                stathtml='<span class="label label-danger arrowed">Void</span>';
                break;
            case 3:
                stathtml='<span class="label label-warning arrowed">Refunded</span>';
                break;
            case 4:
                stathtml='<span class="label label-warning arrowed">Credit</span>';
                break;
            default:
                stathtml='<span class="label arrowed">Unknown</span>';
                break
        }
        return stathtml;
    }

    this.getTransactionRecord = function(ref){
        return getTransactionRecord(ref);
    };

    function getTransactionRecord(ref){
        if (WPOS.getSalesTable().hasOwnProperty(ref)){
            return WPOS.getSalesTable()[ref];
        } else if (WPOS.hasOwnProperty('sales') && WPOS.sales.getOfflineSales().hasOwnProperty(ref)){ // check offline sales
            return WPOS.sales.getOfflineSales()[ref];
        } else if (remtrans.hasOwnProperty(ref)) { // check in remote transaction table
            return remtrans[ref];
        } else {
            return false;
        }
    }

    this.populateTransactionInfo = function(ref){
        populateTransactionInfo(ref);
    };

    function populateTransactionInfo(ref){
        var record = getTransactionRecord(ref);
        var status = getTransactionStatus(ref);
        if (record===false){
            swal({
                type: 'error',
                title: 'Oops...',
                text: 'Could not find the transaction record!'
              });
              
        }
        // set values in info div
        $("#transstat").html(getStatusHtml(status));
        $("#transref").text(ref);
        $("#transid").text(record.id);
        $("#transtime").text(WPOS.util.getDateFromTimestamp(record.processdt));
        $("#transptime").text(record.dt);
        var config = WPOS.getConfigTable();
        $("#transuser").text((config.users.hasOwnProperty(record.userid) ? config.users[record.userid].username : 'NA'));
        $("#transdev").text((config.devices.hasOwnProperty(record.devid) ? config.devices[record.devid].name : 'NA'));
        $("#transloc").text((config.locations.hasOwnProperty(record.locid) ? config.locations[record.locid].name : 'NA'));
        $("#transnotes").val(record.salenotes);

        $("#transsubtotal").text(WPOS.util.currencyFormat(record.subtotal));
        populateTaxinfo(record);
        if (record.discount>0){
            $("#transdiscount").text(WPOS.util.currencyFormat(record.discount));
            $("#transdisdiv").show();
        } else {
            $("#transdisdiv").hide();
        }
        $("#transtotal").text(WPOS.util.currencyFormat(record.total));

        populateItemsTable(record.items);
        populatePaymentsTable(record.payments, ref);
        if (status == 3){
            $("#voidinfo").show();
            $("#orderbuttons").hide();
            if (status==2){
                // hide buttons if void
                $("#voidbuttons").hide();
            } else {
                $("#voidbuttons").show();
            }
            // populate void/refund list
            populateRefundTable(record);
        } else {
            if (status ==0){
                $("#voidbuttons").hide();
                $("#orderbuttons").show();
            } else {
                $("#orderbuttons").hide();
                $("#voidbuttons").show();
            }
            $("#voidinfo").hide();
        }
    }

    function populateTaxinfo(record){
        var transtax = $('#transtax');
        transtax.html('');
        var taxitems = WPOS.getTaxTable().items;
        if (record.hasOwnProperty('taxdata')){
            for (var i in record.taxdata){
                transtax.append('<label class="fixedlabel">'+taxitems[i].name+' ('+taxitems[i].value+'%):</label><span>'+WPOS.util.currencyFormat(record.taxdata[i])+'</span><br/>');
            }
        }
    }

    function populateItemsTable(items){
        var itemtable = $("#transitemtable");
        $(itemtable).html('');
        var taxitems = WPOS.getTaxTable().items;
        for (var i = 0; i<items.length; i++){
            if (items[i].qty==0)
                continue;
            // tax details
            var taxStr = "";
            for (var x in items[i].tax.values){
                taxStr += WPOS.util.currencyFormat(items[i].tax.values[x]) + " (" + taxitems[x].name + " " + taxitems[x].value + "%) <br/>";
            }
            if (taxStr == "")
                taxStr = WPOS.util.currencyFormat(0.00);
            // item mod details
            var modStr = "";
            if (items[i].hasOwnProperty('mod')){
                for (x=0; x<items[i].mod.items.length; x++){
                    var mod = items[i].mod.items[x];
                    modStr+= '<br/>'+(mod.hasOwnProperty('qty')?(mod.qty>0?'+ ':'')+mod.qty:'')+' '+mod.name+(mod.hasOwnProperty('value')?': '+mod.value:'')+' ('+WPOS.util.currencyFormat(mod.price)+')';
                }
            }
            $(itemtable).append('<tr><td>'+items[i].qty+'</td><td>'+items[i].name+modStr+'</td><td>'+WPOS.util.currencyFormat(items[i].unit)+'</td><td>'+taxStr+'</td><td>'+WPOS.util.currencyFormat(items[i].price)+'</td></tr>');
        }
    }

    function populatePaymentsTable(payments, ref){
        var paytable =$("#transpaymenttable");
        $(paytable).html('');
        var method, amount;
        for (var i = 0; i<payments.length; i++){
            // catch extras
            method = payments[i].method;
            amount = payments[i].amount;
            var paydetailsbtn = '';
            if (payments[i].hasOwnProperty('paydata')){
                // check for integrated payment details
                if (payments[i].paydata.hasOwnProperty('transRef')){
                    paydetailsbtn = "<button onclick='WPOS.trans.showPaymentInfo(this);' class='btn btn-xs btn-primary' data-paydata='"+JSON.stringify(payments[i].paydata)+"'>Details</button>";
                }
                // catch cash-outs
                if (payments[i].paydata.hasOwnProperty('cashOut')){
                    method = "cashout ("+WPOS.util.currencyFormat((-amount).toFixed(2))+")";
                }
            }
            // transaction code
            if(payments[i].hasOwnProperty('transactionCode')) {
                method = method + ' - ' + payments[i].transactionCode;
            }
            // Add complete payments button
            if (payments[i].method === 'credit') {
                paydetailsbtn = '<button class="btn btn-primary" onclick="WPOS.trans.showPaymentDialog(\''+ref+'\');">Add Payment</button>';
            }
            $(paytable).append('<tr><td>'+WPOS.util.capFirstLetter(method)+'</td><td>'+WPOS.util.currencyFormat(amount)+'</td><td style="text-align: right;">'+paydetailsbtn+'</td></tr>');
        }
    }

    var curtransref;

    function populateRefundTable(record){
        curtransref = record.ref;
        var refundtable = $("#transvoidtable");
        $(refundtable).html("");
        if (record.refunddata !== undefined){
            var tempdata;
            for (var i = 0; i<record.refunddata.length; i++){
                tempdata = record.refunddata[i];
                $(refundtable).append('<tr><td><span class="label label-warning arrowed">Refund</span></td><td>'+WPOS.util.getDateFromTimestamp(tempdata.processdt)+'</td><td><button class="btn btn-sm btn-primary" onclick="WPOS.trans.showRefundDialog('+i+');">View</button></td></tr>');
            }
        }
        if (record.voiddata !== undefined && record.voiddata !== null){
            $(refundtable).append('<tr><td><span class="label label-danger arrowed">Void</span></td><td>'+WPOS.util.getDateFromTimestamp(record.voiddata.processdt)+'</td><td><button class="btn btn-sm btn-primary" onclick="WPOS.trans.showVoidDialog();">View</button></td></tr>');
        }
    }

    function getVoidData(ref, isrefund){
        var record;
        record = getTransactionRecord(ref);
        if (isrefund){
            return record.refunddata;
        } else {
            return record.voiddata;
        }
    }

    function populateSharedVoidData(record){
        $("#transreftime").text(WPOS.util.getDateFromTimestamp(record.processdt));
        var config = WPOS.getConfigTable();
        $("#transrefuser").text((config.users.hasOwnProperty(record.userid) ? config.users[record.userid].username : 'NA'));
        $("#transrefdev").text((config.devices.hasOwnProperty(record.deviceid) ? config.devices[record.deviceid].name : 'NA'));
        $("#transrefloc").text((config.locations.hasOwnProperty(record.locationid) ? config.locations[record.locationid].name : 'NA'));
        $("#transrefreason").text(record.reason);
    }

    this.showVoidDialog = function(){
        populateVoidData(curtransref);
        $("#refunddetails").hide(); // the dialog is used for refunds too, hide that view
        var voiddiv = $("#voiddiv");
        voiddiv.dialog("option", "title", "Void Details");
        voiddiv.dialog('open');
    };

    function populateVoidData(ref){
        var record;
        record = getVoidData(ref, false);
        populateSharedVoidData(record);
    }

    this.showRefundDialog = function(refundindex){
        populateRefundData(curtransref, refundindex);
        $("#refunddetails").show(); // show the refund only view.
        var voiddiv = $("#voiddiv");
        voiddiv.dialog("option", "title", "Refund Details");
        voiddiv.dialog('open');
    };

    function populateRefundData(ref, refundindex){
        var record;
        record = getVoidData(ref, true);
        record = record[refundindex]; // get the right refund record from the array
        populateSharedVoidData(record);
        $("#transrefmethod").text(record.method);
        $("#transrefamount").text(WPOS.util.currencyFormat(record.amount));
        // show payment details button if available
        var dtlbtn = $("#refpaydtlbtn");
        if (record.hasOwnProperty('paydata')){
            dtlbtn.removeClass('hide');
            //console.log(record.paydata);
            dtlbtn.data('paydata', record.paydata);
        } else {
            dtlbtn.addClass('hide');
        }
        // populate refunded items
        var treftable = $("#transrefitemtable");
        treftable.html("");
        for (var i = 0; i<record.items.length; i++){
            treftable.append("<tr><td>"+getSaleItemData(ref, record.items[i].ref, record.items[i].id).name+"</td><td>"+record.items[i].numreturned+"</td></tr>");
        }
    }

    this.showPaymentInfo = function(btn){
        // the data is already stored in a HTML5 data element
        console.log($(btn).data('paydata'));
        showEftPaymentDialog($(btn).data('paydata'));
    };

    var paydialoginit = false;
    function showEftPaymentDialog(object){
        var paydialog = $("#eftdetailsdialog");
        if (!paydialoginit){
            paydialoginit = true;
            paydialog.removeClass('hide').dialog({
                maxWidth : 200,
                width : 'auto',
                modal   : true,
                autoOpen: false,
                buttons: [
                    {
                        html: "<i class='icon-remove bigger-110'></i>&nbsp; Close",
                        "class": "btn btn-xs",
                        click: function () {
                            $(".keypad-popup").hide();
                            paydialog.dialog('close');
                        }
                    }
                ],
                create: function( event, ui ) {
                }
            });
        }
        $("#efttransref").text(object.transRef);
        $("#efttranscard").text(object.cardType);
        $("#eftcustrec").text(object.customerReceipt);
        $("#eftmerchrec").text(object.merchantReceipt);
        paydialog.dialog('open');
    }

    function getSaleItemData(ref, itemref, itemid){
        var items = getTransactionRecord(ref).items;
        for (var key in items){
            if (items[key].ref == itemref){
                return items[key];
            } else if (items[key].id == itemid){
                return items[key];
            }
        }
        return false;
    }

    function clearTransactions(){
        transtable = {};
    }

    var transtable = {};

    function loadLocalTransactions() {
        clearTransactions();
        var salestable = WPOS.getSalesTable();
        // Populate synced records
        for (var ref in salestable) {
            transtable[ref] = salestable[ref];
        }
        // Populate offline records
        if (WPOS.hasOwnProperty('sales') && WPOS.sales.getOfflineSalesNum() > 0) {
            var olsales = WPOS.sales.getOfflineSales();
            //var syncstat, gid;
            for (ref in olsales) {
                // add to the transaction info table
                delete transtable[ref];
                transtable[ref] = olsales[ref];
            }

        }
        // load into datatables
        loadIntoTable(transtable);
    }

    function getTransactionStatus(ref){
        var record = getTransactionRecord(ref);
        var credit = hasCredit(record.payments);
        if (record.hasOwnProperty('voiddata')){
            return 2;
        } else if (record.hasOwnProperty("refunddata")){
            // refund
            return 3;
        } else if (record.hasOwnProperty("isorder")){
            return 0;
        } else if (credit){
            return 4;
        }
        return 1;
    }

    function hasCredit(payments) {
        var has = false;
         for(var i=0;i<payments.length;i++) {
             if (payments[i].method === "credit" && payments[i].amount > 0) {
                 has = true;
             }
         }
         return has;
    }

    this.searchRemote = function(){
        var searchdata =  {};
        var refinput = $("#remsearchref");
        if (refinput.val()!=""){
            searchdata.ref = refinput.val();
        }
        if (Object.keys(searchdata).length>0){
            searchRemoteTransactions(searchdata);
        } else {
            swal({
                type: 'error',
                title: 'Oops...',
                text: 'Please select at least one search option.'
              });
              
        }
    };

    var remtrans = {};

    function searchRemoteTransactions(searchdata) {
        WPOS.sendJsonDataAsync("sales/search", JSON.stringify(searchdata), function(result){
            if (result !== false){
                loadIntoTable(remtrans);
                repositionDialog();
            }
        });
    }

    this.clearSearch = function(){
        loadIntoTable(transtable);
        $("#remsearchref").val('');
        repositionDialog();
    };

    this.updateSaleNotes = function(){
        if (WPOS.isOnline()){
            updateSaleNotes();
        } else {
            // TODO: update notes and misc info offline
            swal({
                type: 'error',
                title: 'Oops...',
                text: 'Updating notes offline is not supported at this time\nsorry for the inconvenience'
              });
              
        }
    };

    function updateSaleNotes(){
        var answer = confirm("Save sale notes?");
        if (answer){
            // show loader
            WPOS.util.showLoader();
            var ref = $('#transref').text();
            var notes = $('#transnotes').val();
            WPOS.sendJsonDataAsync("sales/updatenotes", JSON.stringify({"ref":ref, "notes":notes}), function(result){

                if (result!==false){
                    // update local copy
                    var sale = WPOS.trans.getTransactionRecord(ref);
                    if (sale!=false){
                        // set new notes
                        sale.salenotes = notes;
                        if (WPOS.sales.isSaleOffline(ref)===true){
                            WPOS.sales.updateOfflineSale(sale, "sales/updatenotes");
                        } else {
                            WPOS.updateSalesTable(ref, sale)
                        }
                    }
                }
                // hide loader
                WPOS.util.hideLoader();
            });
        }
    }
    this.updateSalePayments = function(){
        if (WPOS.isOnline()){
          updateSalePayments();
        } else {
            // TODO: update notes and misc info offline
            swal({
                type: 'error',
                title: 'Oops...',
                text: 'Updating notes offline is not supported at this time\nsorry for the inconvenience'
              });
              
        }
    };

    function updateSalePayments(){
      // show loader
      var ref = sale.ref;
      WPOS.util.showLoader();
      WPOS.sendJsonDataAsync("sales/updatepayments", JSON.stringify({"ref":sale.ref, "payments":sale.payments}), function(result){
        if (result!==false){
          // update local copy
          if (sale!=false){
            // set new payments
            if (WPOS.sales.isSaleOffline(ref)===true){
              WPOS.sales.updateOfflineSale(sale, "sales/updatepayments");
            } else {
              WPOS.updateSalesTable(sale.ref, sale)
            }
          }
        }
        // hide loader
        WPOS.util.hideLoader();
      });
    }

}