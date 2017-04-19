/**
 * Created by iftekar on 24/5/16.
 */
(function() {
    var childProcess = require("child_process");
    var oldSpawn = childProcess.spawn;
    function mySpawn() {
        console.log('spawn called');
        console.log(arguments);
        var result = oldSpawn.apply(this, arguments);
        return result;
    }
    childProcess.spawn = mySpawn;
})();

var maxSize = 10 * 1024 * 1024 *1024;

var mailer = require("nodemailer");

var CryptoJS = require("crypto");
var express = require('express');
var request = require('request');
var cheerio = require('cheerio');
var app = express();

var port = process.env.PORT || 2007; 				// set the port

var http = require('http').Server(app);

var bodyParser = require('body-parser');
app.use(bodyParser.json({ parameterLimit: 1000000,
    limit: 1024 * 1024 * 10}));
app.use(bodyParser.urlencoded({ parameterLimit: 1000000,
    limit: 1024 * 1024 * 10, extended: false}));
var multer  = require('multer');
var datetimestamp='';
var filename='';
var storage = multer.diskStorage({ //multers disk storage settings
    destination: function (req, file, cb) {
        cb(null, './uploads/');
    },
    filename: function (req, file, cb) {

        filename=file.originalname.split('.')[0].replace(' ','') + '-' + datetimestamp + '.' + file.originalname.split('.')[file.originalname.split('.').length -1];
        cb(null, filename);
    }
});

var upload = multer({ //multer settings
    storage: storage,
    limits: { fileSize: maxSize }
}).single('file');


app.use(bodyParser.json({type: 'application/vnd.api+json'})); // parse application/vnd.api+json as json

app.use(function(req, res, next) { //allow cross origin requests
    res.setHeader("Access-Control-Allow-Methods", "POST, PUT, OPTIONS, DELETE, GET");
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});


var EventEmitter = require('events').EventEmitter;

const emitter = new EventEmitter()

emitter.setMaxListeners(0)


/** API path that will upload the files */
app.post('/uploads', function(req, res) {

    datetimestamp = Date.now();
    upload(req,res,function(err){
        if(err){
            res.json({error_code:1,err_desc:err});
            return;
        }
        res.json({error_code:0,filename:filename});
    });
});

var mongodb = require('mongodb');
var url = 'mongodb://localhost:27017/bankmonark';

var MongoClient = mongodb.MongoClient;

MongoClient.connect(url, function (err, database) {
    if (err) {
        console.log(err);

    }else{
        console.log('Mongo Connected');
        db=database;

    }});

//get default function
app.get('/',function(req,resp){
    var collection = db.collection('users');

    collection.find().toArray(function(err, items) {



        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            resp.send(JSON.stringify({'res':items}));
        }

    });
});
//get default function
app.get('/accesscodes',function(req,resp){
    var collection = db.collection('accesscodes');

    collection.find().toArray(function(err, items) {

        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            resp.send(JSON.stringify({'res':items}));
        }

    });
});

//get default function
app.get('/funds',function(req,resp){
    var collection = db.collection('funds');

    collection.find().toArray(function(err, items) {



        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            resp.send(JSON.stringify({'res':items}));
        }

    });
});


//get default function
app.get('/accounts',function(req,resp){
    var collection = db.collection('accounts');

    collection.find().toArray(function(err, items) {



        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            resp.send(JSON.stringify({'res':items}));
        }

    });
});

//get default function
app.get('/ipaddrs',function(req,resp){
    var collection = db.collection('ipaddress');

    collection.find().sort( { time: -1 } ).toArray(function(err, items) {

        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            resp.send(JSON.stringify({'res':items}));
        }

    });
});

//get default function
app.get('/ip-list',function(req,resp){
    var collection=db.collection('ipaddress').aggregate([

        {
            $lookup : {
                from: "users",
                localField: "user_mail",
                foreignField: "email",
                as: "userdet"
            }

        },
        { $sort : { time: -1 } },
        { $match: { "userdet": { $ne: [] } } },

    ]);

    collection.toArray(function(err,items){
        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            resp.send(JSON.stringify({'res':items}));
        }
    });
});



/**********************************For Admin [start]***********************************************/

app.post('/add-admin',function(req,resp){


    var collection = db.collection('users');

    var crypto = require('crypto');

    var secret = req.body.password;
    var hash = crypto.createHmac('sha256', secret)
        .update('password')
        .digest('hex');


    collection.insert([{
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        email: req.body.email,
        password: hash,
        phone: req.body.phone,
        address: req.body.address,
        city: req.body.city,
        state: req.body.state,
        zip: req.body.zip,
        added_time: Math.floor(Date.now() / 1000),
        status: 0,
        supradmin: parseInt(req.body.supradmin),
        type:1 //1=>admin, 0=>user
    }], function (err, result) {
        if (err) {
            resp.send(JSON.stringify({'status':'error','id':0}));
        } else {
            mailsend('usersignup',req.body.email,{firstname:req.body.firstname,email:req.body.email,time:Math.floor(Date.now() / 1000),id:result.ops[0]._id});
            resp.send(JSON.stringify({'status':'success','id':result.ops[0]._id}));
        }
    });


});

app.post('/admin-list',function (req,resp) {

    var collection = db.collection('users');

    collection.find({ type: 1 }).toArray(function(err, items) {



        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            resp.send(JSON.stringify({'res':items}));
        }

    });

});

app.post('/admin-details',function(req,resp){

    var resitem = {};

    var collection = db.collection('users');

    var o_id = new mongodb.ObjectID(req.body._id);

    collection.find({_id:o_id}).toArray(function(err, items) {

        if (err) {
            resp.send(JSON.stringify({'status':'error','id':0}));
        } else {
            resitem = items[0];

            resp.send(JSON.stringify({'status':'success','item':resitem}));
        }
    });

});

app.post('/edit-admin',function(req,resp){
    var collection = db.collection('users');

    var data = {
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        phone: req.body.phone,
        address: req.body.address,
        city: req.body.city,
        state: req.body.state,
        zip: req.body.zip
    }

    var o_id = new mongodb.ObjectID(req.body.id);

    collection.update({_id:o_id}, {$set: data}, true, true);

    resp.send(JSON.stringify({'status':'success'}));
});

app.post('/admin-del',function(req,resp){
    var collection = db.collection('users');

    var o_id = new mongodb.ObjectID(req.body.id);

    collection.remove( {"_id": o_id});

    resp.send(JSON.stringify({'status':'success'}));

});



app.post('/adminlogin',function(req,resp){

    var resitem = {};

    var crypto = require('crypto');

    var secret = req.body.password;
    var hash = crypto.createHmac('sha256', secret)
        .update('password')
        .digest('hex');

    var collection = db.collection('admins');

    collection.find({ email:req.body.email , password: hash }).toArray(function(err, items) {
        if(err){
            resp.send(JSON.stringify({'status':'error','msg':'Database error occurred! Try again.'}));
        }else{
            if(items.length == 0){
                resp.send(JSON.stringify({'status':'error','msg':'Your information is incorrect.'}));
            }else{
                resitem = items[0];

                resp.send(JSON.stringify({'status':'success','item':resitem}));
            }
        }



    });





});

/**********************************For Admin [end]***********************************************/


/**********************************For user [start]***********************************************/

app.post('/add-user',function(req,resp){


    var collection = db.collection('users');

    var crypto = require('crypto');

    var secret = req.body.password;
    var hash = crypto.createHmac('sha256', secret)
        .update('password')
        .digest('hex');

    collection.find({email:req.body.email}).toArray(function(err, items) {
        if(items.length > 0){
            resp.send(JSON.stringify({'status':'error','id':0,'errf':'email'}));
        }else{

            db.collection('accounts').find({account_no:parseInt(req.body.account_no)}).toArray(function(err, items) {
                if(items.length > 0){
                    resp.send(JSON.stringify({'status':'error','id':0,'errf':'account_no'}));
                }else {
                    collection.insert([{
                        firstname: req.body.firstname,
                        lastname: req.body.lastname,
                        email: req.body.email,
                        password: hash,
                        phone: req.body.phone,
                        address: req.body.address,
                        city: req.body.city,
                        state: req.body.state,
                        zip: req.body.zip,
                        added_time: Math.floor(Date.now() / 1000),
                        status: 0,
                        supradmin:0,
                        type:0 //1=>admin, 0=>user
                    }], function (err, result) {
                        if (err) {
                            resp.send(JSON.stringify({'status':'error','id':0,'errf':''}));
                        } else {

                            console.log(result.ops[0]._id);

                            db.collection('accounts').insert([{
                                user_id : result.ops[0]._id,
                                account_no: parseInt(req.body.account_no),
                                account_type: req.body.account_type,
                                currency: req.body.currency,
                                time: Math.floor(Date.now() / 1000),
                            }], function (err2, result2) {

                                db.collection('funds').insert([{
                                    account_no: parseInt(req.body.account_no),
                                    description: 'Initial Fund',
                                    type: 1, // 1=>credit; 2=> debit
                                    amount: parseFloat(req.body.initial_fund),
                                    currency: req.body.currency,
                                    transfer_from: '',
                                    transfer_to: '',
                                    status: 1, //1=> Completed; 2=> Uncompleted; 3=> Cancelled; 4=>Approved
                                    time: Math.floor(Date.now() / 1000),
                                }], function (err2, result2) {

                                });

                            });
                            mailsend('usersignup',req.body.email,{firstname:req.body.firstname,email:req.body.email,time:Math.floor(Date.now() / 1000),id:result.ops[0]._id});

                            resp.send(JSON.stringify({'status':'success','id':result.ops[0]._id}));
                        }
                    });
                }
            });

        }
    });




});

app.post('/user-list',function (req,resp) {

    var collection = db.collection('users');

    collection.find({ type: 0 }).toArray(function(err, items) {



        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            resp.send(JSON.stringify({'res':items}));
        }

    });

});

app.post('/user-details',function(req,resp){

    var resitem = {};

    var collection = db.collection('users');

    var o_id = new mongodb.ObjectID(req.body._id);

    collection.find({_id:o_id}).toArray(function(err, items) {

        if (err) {
            resp.send(JSON.stringify({'status':'error','id':0}));
        } else {
            resitem = items[0];

            resp.send(JSON.stringify({'status':'success','item':resitem}));
        }
    });

});

app.post('/edit-user',function(req,resp){
    var collection = db.collection('users');

    var data = {
        firstname: req.body.firstname,
        lastname: req.body.lastname,
        phone: req.body.phone,
        address: req.body.address,
        city: req.body.city,
        state: req.body.state,
        zip: req.body.zip
    }

    var o_id = new mongodb.ObjectID(req.body.id);

    collection.update({_id:o_id}, {$set: data}, true, true);

    resp.send(JSON.stringify({'status':'success'}));
});

app.post('/user-statcng',function(req,resp){
    var collection = db.collection('users');

    var o_id = new mongodb.ObjectID(req.body.id);

    collection.update({_id:o_id}, {$set: {status:req.body.status}}, true, true);

    resp.send(JSON.stringify({'status':'success'}));
});

app.post('/user-del',function(req,resp){
    var collection = db.collection('users');

    var o_id = new mongodb.ObjectID(req.body.id);

    collection.remove( {"_id": o_id});

    resp.send(JSON.stringify({'status':'success'}));

});

app.post('/emailverify',function(req,resp){
    var collection = db.collection('users');

    var o_id = new mongodb.ObjectID(req.body.id);

    collection.update({_id:o_id}, {$set: {status:1}}, true, true);

    collection.find({_id:o_id}).toArray(function(err, items) {

        if (err) {
            resp.send(JSON.stringify({'status':'error','id':0}));
        } else {
            resitem = items[0];

            mailsend('useractivate',resitem.email,{});

            resp.send(JSON.stringify({'status':'success'}));
        }
    });


});


app.post('/login',function(req,resp){

    var resitem = {};

    var crypto = require('crypto');

    var secret = req.body.password;
    var hash = crypto.createHmac('sha256', secret)
        .update('password')
        .digest('hex');

    var collection = db.collection('users');

    collection.find({ email:req.body.email , password: hash }).toArray(function(err, items) {
        if(err){
            resp.send(JSON.stringify({'status':'error','msg':'Database error occurred! Try again.'}));
        }else{
            if(items.length == 0){
                resp.send(JSON.stringify({'status':'error','msg':'Your information is incorrect.'}));
            }else{

                resitem = items[0];
                if(resitem.status == 0){
                    resp.send(JSON.stringify({'status':'error','msg':'This user is not activated.'}));
                }else{

                    if(resitem.supradmin == 0){
                        var accesscode = makeaccesscode();

                        db.collection('accesscodes').insert([{
                            user_id: resitem._id,
                            access_code: accesscode,
                            status: 0,
                            time: Math.floor(Date.now() / 1000),
                        }], function (err2, result2) {
                            mailsend('userverification',resitem.email,{accesscode:accesscode});
                        });




                    }

                    if(req.body.ipaddress != ''){
                        db.collection('ipaddress').insert([{
                            user_id: resitem._id,
                            user_mail: resitem.email,
                            ip: req.body.ipaddress,
                            time: Math.floor(Date.now() / 1000),
                        }], function (err2, result2) {

                        });
                    }

                    resp.send(JSON.stringify({'status':'success','item':resitem}));
                }
            }
        }



    });





});

app.post('/login2',function(req,resp){

    var collection = db.collection('accesscodes');



    var o_id = new mongodb.ObjectID(req.body.id);

    collection.find({ user_id : o_id}).sort( { time: -1 } ).limit(1).toArray(function(err, items) {
        if(err){
            resp.send(JSON.stringify({'status':'error','msg':'Database error occurred! Try again.'}));
        }else{
            if(items.length == 0){
                resp.send(JSON.stringify({'status':'error','msg':'Your access code is incorrect.'}));
            }else{

                resitem = items[0];

                if(resitem.access_code == req.body.access_code){
                    if(resitem.status == 1){
                        resp.send(JSON.stringify({'status':'error','msg':'Your access code is already used'}));
                    }else{
                        var currenttime = Math.floor(Date.now() / 1000);
                        var timediff = currenttime - resitem.time;

                        if(timediff > 600){
                            resp.send(JSON.stringify({'status':'error','msg':'Your access code is expired.'}));
                        }else{

                            var o_id = new mongodb.ObjectID(resitem._id);

                            collection.update({_id:o_id}, {$set: {status:1}}, true, true);

                            resp.send(JSON.stringify({'status':'success'}));
                        }

                    }
                }else {
                    resp.send(JSON.stringify({'status':'error','msg':'Your access code is incorrect.'}));
                }



            }
        }



    });
});



app.get('/testupdate',function(req,resp){
    var collection = db.collection('users');

    var data = {
        supradmin: 1,
    }

    var o_id = new mongodb.ObjectID('58dd50089ea7b3ca5d113773');

    collection.update({_id:o_id}, {$set: data}, true, true);

    resp.send(JSON.stringify({'status':'success'}));
});


/**********************************For user [end]***********************************************/



/**********************************For account [start]***********************************************/
app.post('/getAccounts',function(req,resp){

    var o_id = new mongodb.ObjectID(req.body.id);

    var collection = db.collection('accounts');

    collection.find({user_id:o_id}).toArray(function(err, items) {



        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            resp.send(JSON.stringify({'res':items}));
        }

    });
});
app.post('/getAllAccounts',function(req,resp){
    var collection = db.collection('accounts');

    collection.find().toArray(function(err, items) {
        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            resp.send(JSON.stringify({'res':items}));
        }
    });
});
app.post('/getOtherAccounts',function(req,resp){

    var o_id = new mongodb.ObjectID(req.body.id);

    var collection = db.collection('accounts');

    collection.find( { user_id: { $ne: o_id } }).toArray(function(err, items) {



        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            resp.send(JSON.stringify({'res':items}));
        }

    });
});

/**********************************For account [end]***********************************************/

/**********************************Funds [start]****************************************/
app.post('/fundtransfer',function(req,resp){

    db.collection('funds').insert([{
        account_no: parseInt(req.body.source_account),
        description: req.body.description,
        type: 2, // 1=>credit; 2=> debit
        amount: parseFloat(req.body.amount),
        currency: req.body.currency,
        transfer_from: parseInt(req.body.source_account),
        transfer_to: parseInt(req.body.dest_account),
        status: 2, //1=> Completed; 2=> Uncompleted; 3=> Cancelled; 4=>Approved
        time: Math.floor(Date.now() / 1000),
    }], function (err2, result2) {
        resp.send(JSON.stringify({'res':'success'}));
    });

});


app.post('/balance',function(req,resp){

    db.collection('funds').find().toArray(function(err, items) {
        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            var n;
            var balancearr = {};
            for(n in items){
                if(typeof (balancearr[items[n].account_no]) == 'undefined'){
                    balancearr[items[n].account_no] = 0;
                }
                if(items[n].type == 1){
                    balancearr[items[n].account_no] = balancearr[items[n].account_no] + items[n].amount;
                }
                if(items[n].type == 2){
                    balancearr[items[n].account_no] = balancearr[items[n].account_no] - items[n].amount;
                }
            }



            resp.send(JSON.stringify({'res':balancearr}));
        }

    });

});
app.post('/balancebyid',function(req,resp){

    db.collection('funds').find({account_no:req.body.account_no}).toArray(function(err, items) {
        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            var n;
            var balancearr;
            for(n in items){
                if(typeof (balancearr[items[n].account_no]) == 'undefined')
                    balancearr[items[n].account_no] = 0;

                if(items[n].type == 1){
                    balancearr[items[n].account_no] = balancearr[items[n].account_no] + items[n].amount;
                }
                if(items[n].type == 2){
                    balancearr[items[n].account_no] = balancearr[items[n].account_no] - items[n].amount;
                }
            }
            resp.send(JSON.stringify({'res':balancearr}));
        }

    });

});

app.post('/getTransaction',function(req,resp){

    var o_id = new mongodb.ObjectID(req.body.id);

    var collection = db.collection('accounts');

    collection.find({user_id:o_id}).toArray(function(err, items) {
        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            var accountlist = [];
            for (n in items){
                accountlist.push(items[n].account_no);
            }

            db.collection('funds').find({ account_no: { $in: accountlist } }).sort( { time: -1 } ).limit(10).toArray(function(err2, items2) {

                if(err2){
                    resp.send(JSON.stringify({'res':[]}));
                }else{
                    resp.send(JSON.stringify({'res':items2}));
                }


            });


        }

    });

});

app.post('/getTransaction2',function(req,resp){
    var collection = db.collection('accounts');

    collection.find().toArray(function(err, items) {
        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            var accountlist = [];
            for (n in items){
                accountlist.push(items[n].account_no);
            }

            db.collection('funds').find({ account_no: { $in: accountlist } }).sort( { time: -1 } ).limit(10).toArray(function(err2, items2) {

                if(err2){
                    resp.send(JSON.stringify({'res':[]}));
                }else{
                    resp.send(JSON.stringify({'res':items2}));
                }


            });


        }

    });

});

app.post('/getAllTransaction',function(req,resp){

    var o_id = new mongodb.ObjectID(req.body.id);

    var collection = db.collection('accounts');

    collection.find({user_id:o_id}).toArray(function(err, items) {
        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            var accountlist = [];
            for (n in items){
                accountlist.push(items[n].account_no);
            }

            //db.collection('funds').find({ account_no: { $in: accountlist } }).sort( { time: -1 } ).toArray(function(err2, items2) {
            //db.collection('funds').find({ time : { $gt :  req.body.sttime, $lt : req.body.endtime}}).toArray(function(err2, items2) {
            db.collection('funds').find({ $and: [ { account_no: { $in: accountlist } }, { time : { $gt :  req.body.sttime, $lt : req.body.endtime}} ] } ).sort( { time: -1 } ).toArray(function(err2, items2) {

                if(err2){
                    resp.send(JSON.stringify({'res':[]}));
                }else{
                    resp.send(JSON.stringify({'res':items2}));
                }


            });


        }

    });

});


app.post('/getAllTransaction2',function(req,resp){

    var collection = db.collection('accounts');

    collection.find().toArray(function(err, items) {
        if (err) {
            resp.send(JSON.stringify({'res':[]}));
        } else {
            var accountlist = [];
            for (n in items){
                accountlist.push(items[n].account_no);
            }
            db.collection('funds').find({ $and: [ { account_no: { $in: accountlist } }, { time : { $gt :  req.body.sttime, $lt : req.body.endtime}} ] } ).sort( { time: -1 } ).toArray(function(err2, items2) {

                if(err2){
                    resp.send(JSON.stringify({'res':[]}));
                }else{
                    resp.send(JSON.stringify({'res':items2}));
                }


            });


        }

    });

});


app.post('/cancelTransaction',function(req,resp){

    var collection = db.collection('funds');

    var data = {
        amount: 0,
        cancel_amount: parseFloat(req.body.amount),
        status: 3,
    }

    var o_id = new mongodb.ObjectID(req.body.id);

    collection.update({_id:o_id}, {$set: data}, true, true);

    resp.send(JSON.stringify({'status':'success'}));

});

app.post('/approveTransaction',function(req,resp){

    var item = req.body.item

    db.collection('funds').insert([{
        account_no: parseInt(item.transfer_to),
        description: item.description,
        type: 1, // 1=>credit; 2=> debit
        amount: parseFloat(item.amount),
        currency: item.currency,
        transfer_from: parseInt(item.transfer_from),
        transfer_to: parseInt(item.transfer_to),
        status: 1, //1=> Completed; 2=> Uncompleted; 3=> Cancelled; 4=>Approved
        time: Math.floor(Date.now() / 1000),
    }], function (err2, result2) {
        if(!err2){
            var o_id = new mongodb.ObjectID(item._id);

            db.collection('funds').update({_id:o_id}, {$set: {status: 1}}, true, true);

            resp.send(JSON.stringify({'status':'success'}));
        }
    });

});


/**********************************Funds [end]******************************************/


/************************************Mail Send[start]*****************************************/
function mailsend(type,email,params){

    var from= 'Support <support@bankmonarch.com>';
    if(type=='usersignup'){

        var subject='WELCOME TO BANK MONARCH';
        var html='Welcome '+params.firstname+',<br><br>You have been granted access to view certain corporate documents. We would like you to know we are excited that you’re on board with us!<br><br>Below is your login information – Login Link: <a href="http://bankmonarch.westcoastvg.online/login">http://bankmonarch.westcoastvg.online/login</a><br><br>Username: '+params.email+'<br><br>Please click on the link below to activate your account.<br><br><a href="http://bankmonarch.westcoastvg.online/email-verify/'+params.id+'/'+params.time+'">http://bankmonarch.westcoastvg.online/email-verify/'+params.id+'/'+params.time+'</a><br><br>--Bank Monarch Team.';
    }

    if(type=='userverification'){

        var subject='2nd step verification of login in  BANK MONARCH';
        var html='Your Access Code Is <strong>'+params.accesscode+'</strong><br><br>--Bank Monarch Team.';
    }

    if(type=='useractivate'){

        var subject='ACTIVATED YOUR ACCOUNT';
        var html='Your account is activated.<br><br>--Bank Monarch Team.';
    }

    var smtpTransport = mailer.createTransport("SMTP", {
        service: "Gmail",
        auth: {
            user: "john71838@gmail.com",
            pass: "altec212"
        }
    });

    var mail = {
        /*  from: "Admin <samsujdev@gmail.com>",*/
        from: from,
        to: email,
        subject: subject,
        //text: "Node.js New world for me",
        html: html
    }

    smtpTransport.sendMail(mail, function (error, response) {
        //resp.send((response.message));
        console.log('error: '+error);
        console.log('response: '+response);
        smtpTransport.close();
    });

}

app.get('/testemail',function(req,resp){

    var html='<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">\
       <html xmlns="http://www.w3.org/1999/xhtml">\
       <head>\
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />\
        <title>Mail Page 3</title>\
    </head>\
    <body>\
       <div style="width:640px; margin:0 auto; background:#f9f0e1; padding:20px;">\
       <div style="width:620px;">\
       <div style="width:100%; background:#fff; padding:10px; border-bottom:solid 1px #ccc; ">\
       <table width="100%" border="0">\
        <tr>\
        <td align="left" valign="top"><img src="http://probiddealer.influxiq.com/images/logo1.png"  alt="#" style="margin:10px;"/></td>\
        <td align="right" valign="middle"  ><span style="font-family:Arial, Helvetica, sans-serif; font-size:13px; color:#000;"><strong  style="color:#fb4a32;"> Date:</strong> 12.2.2016 </span></td>\
    </tr>\
    </table>\
       <h2 style="text-align:left; font-family:Arial, Helvetica, sans-serif; font-size:16px; line-height:30px; background:#fb4a32; padding:10px; margin:15px 0 15px 0; color:#fff; font-weight:normal;"><span style="font-weight:bold; font-style:italic;">Subject:</span>  [[Dealership Name]] has sent a new car for you to check out.</h2>\
       <div style="width:100%; background:#f9f0e1; border:solid 1px #dbd2c4; margin:5px 0 15px 0; height:40px;">\
        <div style="width:40%; background:#96ff00; height:40px; text-align:center; font-family:Arial, Helvetica, sans-serif; line-height:40px; color:#333; font-size:12px;">40%</div>\
        </div>\
       <img src="http://probiddealer.influxiq.com/images/cd1_bigcar1.jpg"  alt="#" style="width:100%; border:solid 1px #ccc;"/>\
       <table width="100%" border="0" cellspacing="0" cellpadding="0" style="font-family:Arial, Helvetica, sans-serif; font-size:14px; color:#111; margin:15px 0; border-top:solid 1px #cdc7bd;">\
       <tr>\
        <td align="left" valign="middle"  style="background:#f9f0e1; padding: 10px; border:solid 1px #cdc7bd; border-right:none; border-top:none;">Make: </td>\
    <td align="right" valign="middle"  style="background:#f9f0e1; padding: 10px;  border:solid 1px #cdc7bd;  border-top:none;">Audi</td>\
        </tr>\
       <tr>\
        <td align="left" valign="middle"  style="background:#f9f0e1; padding: 10px; border:solid 1px #cdc7bd; border-right:none; border-top:none;">Model:</td>\
    <td align="right" valign="middle"  style="background:#f9f0e1; padding: 10px;  border:solid 1px #cdc7bd;  border-top:none;">A6 2.0T Quattro Premium Plus</td>\
    </tr>\
       <tr>\
    <td align="left" valign="middle"  style="background:#f9f0e1; padding: 10px; border:solid 1px #cdc7bd; border-right:none; border-top:none;">Year:</td>\
    <td align="right" valign="middle"  style="background:#f9f0e1; padding: 10px;  border:solid 1px #cdc7bd;  border-top:none;">2013</td>\
        </tr>\
        <tr>\
        <td align="left" valign="middle"  style="background:#f9f0e1; padding: 10px; border:solid 1px #cdc7bd; border-right:none; border-top:none;">Miles:</td>\
    <td align="right" valign="middle"  style="background:#f9f0e1; padding: 10px;  border:solid 1px #cdc7bd;  border-top:none;">Under 45,000</td>\
    </tr>\
       <tr>\
    <td align="left" valign="middle"  style="background:#f9f0e1; padding: 10px; border:solid 1px #cdc7bd; border-right:none; border-top:none;">Color:</td>\
    <td align="right" valign="middle"  style="background:#f9f0e1; padding: 10px;  border:solid 1px #cdc7bd;  border-top:none;">Gray</td>\
        </tr>\
        <tr>\
        <td align="left" valign="middle"  style="background:#f9f0e1; padding: 10px; border:solid 1px #cdc7bd; border-right:none; border-top:none;">Wholesale:</td> <td align="right" valign="middle"  style="background:#f9f0e1; padding: 10px;  border:solid 1px #cdc7bd;  border-top:none;">24,493 USD</td>\
    </tr>\
       </table>\
       <h2 style="background:#fb4a32; margin:0; padding:10px; text-align:center; font-family:Arial, Helvetica, sans-serif; font-size:20px; color:#eee1cb; text-transform:uppercase; font-weight:normal;"><a href="javascript:void(0)" style="font-style:italic; color:#eca463; font-weight:bold; text-decoration:none;">Click Here</a> to get more details about this car.</h2>\
       <h2 style="margin:15px 0 0 0; padding:15px; font-family:Arial, Helvetica, sans-serif; text-align:center; font-weight:normal; font-size:16px; color:#333;"> Please login to your account to learn more about the car and other options.</h2>\
       <a href="javascript:void(0)" style="font-style:italic; color:#fff; background:#fb4a32; padding:8px 10px; text-decoration:none; font-family:Arial, Helvetica, sans-serif; display:block; width:100px; margin:0 auto; text-align:center; margin-bottom:20px; text-transform:uppercase; font-weight:bold;">Login</a>\
       </div>\
       <div style="width:100%; padding:10px;">\
       <h2 style="text-align:center; font-family:Arial, Helvetica, sans-serif; font-size:22px; line-height:30px; text-align:center; padding:0px; margin:20px 10px 15px 10px; color:#9c9c9c; font-weight:normal; font-style:italic;">Checkout our Social media pages for latest updates:</h2>\
       <div style="display:block; width:100%; text-align:center;">\
        <a href="javascript:void(0)"><img src="http://probiddealer.influxiq.com/images/mailicon1.png"  alt="#" style="margin:5px;"/></a>\
        <a href="javascript:void(0)"><img src="http://probiddealer.influxiq.com/images/mailicon2.png"  alt="#"  style="margin:5px;"/></a>\
        <a href="javascript:void(0)"><img src="http://probiddealer.influxiq.com/images/mailicon3.png"  alt="#"  style="margin:5px;"/></a>\
        <a href="javascript:void(0)"><img src="http://probiddealer.influxiq.com/images/mailicon4.png"  alt="#"  style="margin:5px;"/></a>\
        </div>\
       <h3  style="text-align:center; font-family:Arial, Helvetica, sans-serif; font-size:12px; line-height:20px; text-align:center; padding:0px; margin:10px 20px 10px 20px; color:#9c9c9c; font-weight:normal;"> Copyright © 2016-2017 probidauto. All rights reserved.</h3>\
       </div>\
       </div>\
       </div>\
       </body>\
    </html>';
    var smtpTransport = mailer.createTransport("SMTP", {
        service: "Gmail",
        auth: {
            user: "john71838@gmail.com",
            pass: "altec212"
        }
    });

    var mail = {
        from: "Admin <samsujdev@gmail.com>",
        to: 'samsujj@gmail.com',
        subject: 'test email',
        //text: "Node.js New world for me",
        html: html
    }

    smtpTransport.sendMail(mail, function (error, response) {
         resp.send(JSON.stringify(error));
        console.log('send');
        smtpTransport.close();
    });
});
/************************************Mail Send[end]*******************************************/

function makeaccesscode()
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < 5; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

app.listen(port);
 console.log("App listening on port " + port);

