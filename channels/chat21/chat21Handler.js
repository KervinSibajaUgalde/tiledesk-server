
const messageEvent = require('../../event/messageEvent');
const authEvent = require('../../event/authEvent');
const botEvent = require('../../event/botEvent');
const requestEvent = require('../../event/requestEvent');
const groupEvent = require('../../event/groupEvent');
const chat21Event = require('./chat21Event');
const leadEvent = require('../../event/leadEvent');

var messageService = require('../../services/messageService');
var MessageConstants = require("../../models/messageConstants");
var ChannelConstants = require("../../models/channelConstants");
var winston = require('../../config/winston');
var Request = require("../../models/request");
var chat21Config = require('./chat21Config');
var chat21 = require('./chat21Client');





const MaskData = require("maskdata");

const maskPasswordOptions = {
    // Character to mask the data. default value is '*'
    maskWith : "*",
    //Should be positive Integer
    // If the starting 'n' digits needs to be unmasked
    // Default value is 4
    unmaskedStartDigits: 3, 
    
    // Should be positive Integer
    //If the ending 'n' digits needs to be unmasked
    // Default value is 1
    unmaskedEndDigits: 2
  };




// var chat21Util = require('./chat21Util');
// var tiledeskUtil = require('./tiledesk-util');

var adminToken =  process.env.CHAT21_ADMIN_TOKEN || chat21Config.adminToken;

const masked_adminToken = MaskData.maskPhone(adminToken, maskPasswordOptions);

winston.info('Chat21Handler adminToken: '+ masked_adminToken);




class Chat21Handler {

 
    typing(message, timestamp) {
        return new Promise(function (resolve, reject) {

            //no typing for subtype info
            if (message.attributes && message.attributes.subtype && message.attributes.subtype==='info') {
                return resolve();
            }else {
                chat21.conversations.typing(message.recipient, message.sender, message.text, timestamp).finally(function() {
                    return resolve();
                });
            }
            

        });
    }


    listen() {

        var that = this;       
       
        winston.debug("Chat21Handler listener start ");
        
      
        // su projectUser create e update
        authEvent.on('user.signup', function(userData) {
            var firstName = userData.savedUser.firstname;
            var lastName = userData.savedUser.lastname;
            var email = userData.savedUser.email;
            var current_user = userData.savedUser.id;

            setImmediate(() => {
                winston.debug("Chat21Handler on user.signup ",  userData);

                chat21.auth.setAdminToken(adminToken);

                // create: function(firstname, lastname, email, current_user){
                chat21.contacts.create(firstName, lastName, email, current_user).then(function(data) {
                    winston.info("Chat21 contact created: " + JSON.stringify(data));      
                    chat21Event.emit('contact.create', data);                                          
                }).catch(function(err) {
                    winston.error("Error creating chat21 contact ", err);
                    chat21Event.emit('contact.create.error', err);
                });

            });
        });


        authEvent.on('user.update', function(userData) {
            var firstName = userData.updatedUser.firstname;
            var lastName = userData.updatedUser.lastname;            
            var current_user = userData.updatedUser.id;

            setImmediate(() => {
                winston.debug("Chat21Handler on user.update ",  userData);

                chat21.auth.setAdminToken(adminToken);

                // update: function(firstname, lastname, current_user){
                chat21.contacts.update(firstName, lastName, current_user).then(function(data) {
                    winston.info("Chat21 contact updated: " + JSON.stringify(data));      
                    chat21Event.emit('contact.update', data);                                          
                }).catch(function(err) {
                    winston.error("Error updating chat21 contact ", err);
                    chat21Event.emit('contact.update.error', err);
                });

            });
        });


        botEvent.on('faqbot.create', function(bot) {
            var firstName = bot.name;
            var lastName = "";
            var email = "";
            var current_user = "bot_"+bot.id;

            setImmediate(() => {
                winston.debug("Chat21Handler on faqbot.create ",  bot);

                chat21.auth.setAdminToken(adminToken);

                // create: function(firstname, lastname, email, current_user){
                chat21.contacts.create(firstName, lastName, email, current_user).then(function(data) {                    
                    winston.info("Chat21 contact created: " + JSON.stringify(data));         
                    chat21Event.emit('contact.create', data);                                          
                }).catch(function(err) {
                    winston.error("Error creating chat21 contact ", err);
                    chat21Event.emit('contact.create.error', err);
                });

            });
        });



        botEvent.on('faqbot.update', function(bot) {
            var firstName = bot.name;
            var lastName = "";
            var current_user = "bot_"+bot.id;

            setImmediate(() => {
                winston.debug("Chat21Handler on faqbot.create ",  bot);

                chat21.auth.setAdminToken(adminToken);

               // update: function(firstname, lastname, current_user){
                chat21.contacts.update(firstName, lastName, current_user).then(function(data) {
                    winston.info("Chat21 contact updated: " + JSON.stringify(data));      
                    chat21Event.emit('contact.update', data);                                          
                }).catch(function(err) {
                    winston.error("Error updating chat21 contact ", err);
                    chat21Event.emit('contact.update.error', err);
                });

            });
        });


    // quando passa da lead temp a default aggiorna tutti va bene?        

         leadEvent.on('lead.update', function(lead) {
            //  non sembra funzionare chiedi a Dario dove prende le info
            setImmediate(() => {
                winston.debug("Chat21Handler on lead.update ",  lead);

                Request.find({lead: lead._id, id_project: lead.id_project}, function(err, requests) {

                    if (err) {
                        winston.error("Error getting request by lead", err);
                        return 0;
                    }
                    if (!requests || (requests && requests.length==0)) {
                        winston.info("No request found for lead id " +lead._id );
                        return 0;
                    }
                    
                    chat21.auth.setAdminToken(adminToken);

                    requests.forEach(function(request) {
                        if (request.channel.name === ChannelConstants.CHAT21) {

                            winston.info("Chat21Handler  lead.update for request ",  request);
                            
                            var groupName = lead.fullname;
                            if (request.subject) {
                                groupName=request.subject;
                            }
                            // update: function(name, owner, attributes, group_id){
                            chat21.groups.update(groupName, undefined, undefined, request.request_id).then(function(data) {
                                winston.info("Chat21 group updated: " + JSON.stringify(data));      
                                chat21Event.emit('group.update', data);                                          
                            }).catch(function(err) {
                                winston.error("Error updating chat21 group ", err);
                                chat21Event.emit('group.update.error', err);
                            });

                             // updateAttributes: function(attributes, group_id){
                                 var gattributes = {userFullname:lead.fullname, userEmail: lead.email }
                                //  qui1
                            chat21.groups.updateAttributes(gattributes, request.request_id).then(function(data) {
                                winston.info("Chat21 group gattributes updated: " + JSON.stringify(data));      
                                chat21Event.emit('group.update', data);        
                                chat21Event.emit('group.attributes.update', data);                                          
                            }).catch(function(err) {
                                winston.error("Error updating chat21  gattributes group ", err);
                                chat21Event.emit('group.attributes.update.error', err);
                            });


                        }
                    })
                  
                });

              
            });
        });



       

        messageEvent.on('message.sending', function(message) {

            // setImmediate(() => {


                    winston.info("Chat21Sender on message.sending ",  message);


                   if (message && message.status === MessageConstants.CHAT_MESSAGE_STATUS.SENDING && message.request && message.request.channel.name === ChannelConstants.CHAT21) {
                    // if (message && message.status === MessageConstants.CHAT_MESSAGE_STATUS.SENDING) {

                    
                        chat21.auth.setAdminToken(adminToken);

                        //'https://us-central1-chat21-pre-01.cloudfunctions.net/api/tilechat/typings/support-group-LvtMo6VMxX1j3xV3b-X?token=chat21-secret-orgAa,',


                        //chat21.conversations.typing(message.recipient, message.sender, message.text, new Date()).finally(function() {
                        return that.typing(message,new Date() ).then(function() {
                       

                        let attributes = message.attributes;

                        if (!attributes) attributes = {};
                        
                        attributes['tiledesk_message_id'] = message._id;

                        attributes['projectId'] = message.id_project; //TODO not used. used by ionic to open request detail ???
                        
                       


                        winston.info("Chat21Sender sending message.sending ",  message);

                        // chat21Util.getButtonFromText().then(function(messageData) {
                        //     message = messageData;

                            // doent'work must merge older field with new message = chat21Util.parseReply(message.text);

                            // sendToGroup: function(sender_fullname, recipient_id, recipient_fullname, text, sender_id, attributes, type, metadata, timestamp){


                            var timestamp = Date.now();
                            // var timestamp = undefined;
                            if (message.attributes && message.attributes.clienttimestamp) {
                                timestamp = message.attributes.clienttimestamp;
                            }

                            var recipient_fullname = "Guest"; 
                            if (message.request && message.request.lead && message.request.lead.fullname) {
                                recipient_fullname = message.request.lead.fullname;
                            }
                            if (message.request && message.request.subject ) {
                                recipient_fullname = message.request.subject;
                            }

                            /*
                            const parsedReply = tiledeskUtil.parseReply(message.text);
                            winston.info("Chat21 sendToGroup parsedMessage " + JSON.stringify(parsedReply));

                            // message = {...message, ...parsedReply.message };
                            // merge(message, parsedReply.message );

                            if (parsedReply.message.text) {
                                message.text = parsedReply.message.text;
                            }
                            if (parsedReply.message.type) {
                                message.type = parsedReply.message.type;
                            }
                            if (parsedReply.message.type) {
                                message.metadata = parsedReply.message.metadata;
                            }
                            
                            // var msg_attributes = {...message.attributes, ...parsedReply.message.attributes };
                            if (parsedReply.message && parsedReply.message.attributes) {
                                for(const [key, value] of Object.entries(parsedReply.message.attributes)) {
                                    attributes[key] = value
                                }
                            }    
                            */   
                         
                           return  chat21.messages.sendToGroup(message.senderFullname,     message.recipient, 
                                recipient_fullname, message.text, message.sender, attributes, message.type, message.metadata, timestamp)
                                        .then(function(data){
                                            winston.info("Chat21Sender sendToGroup sent: "+ JSON.stringify(data));
                                    

                                            // chat21.conversations.stopTyping(message.recipient,message.sender);
    
                                            chat21Event.emit('message.sent', data);
    
                                                messageService.changeStatus(message._id, MessageConstants.CHAT_MESSAGE_STATUS.DELIVERED) .then(function(upMessage){
                                                    winston.debug("Chat21 message sent ", upMessage.toObject());                                        
                                                }).catch(function(err) {
                                                    winston.error("Error Chat21 message sent with id: "+message._id, err);                                        
                                                });
    
                                }).catch(function(err) {
                                    winston.error("Chat21 sendToGroup err", err);
                                    chat21Event.emit('message.sent.error', err);
                                });

                            });
                        
                        // });
                    }
                // });
            });


            requestEvent.on('request.attributes.update',  function(request) {          

                setImmediate(() => {
                    if (request.channel.name === ChannelConstants.CHAT21) {

                        chat21.auth.setAdminToken(adminToken);

                        var gattributes = request.attributes;
                        // qui1
                        chat21.groups.updateAttributes(gattributes, request.request_id).then(function(data) {
                            winston.info("Chat21 group gattributes updated: " + JSON.stringify(data));      
                            chat21Event.emit('group.update', data);        
                            chat21Event.emit('group.attributes.update', data);                                          
                        }).catch(function(err) {
                            winston.error("Error updating chat21  gattributes group ", err);
                            chat21Event.emit('group.attributes.update.error', err);
                        });

                    }
                });
            });


            // new qui
            requestEvent.on('request.update',  function(request) {          

                setImmediate(() => {
                    if (request.channel.name === ChannelConstants.CHAT21) {

                        chat21.auth.setAdminToken(adminToken);

                        var gattributes = { "_request":request};
                        // qui1
                        chat21.groups.updateAttributes(gattributes, request.request_id).then(function(data) {
                            winston.info("Chat21 group gattributes updated: " +  JSON.stringify(data));      
                            chat21Event.emit('group.update', data);        
                            chat21Event.emit('group.attributes.update', data);                                          
                        }).catch(function(err) {
                            winston.error("Error updating chat21  gattributes group ", err);
                            chat21Event.emit('group.attributes.update.error', err);
                        });

                    }
                });
            });

            requestEvent.on('request.create',  function(request) {          

                // setImmediate(() => {

                    if (request.channel.name === ChannelConstants.CHAT21) {

                        chat21.auth.setAdminToken(adminToken);

                        

                        // let requestObj = request.toObject();
                        let requestObj = request.toJSON();
                        
                        winston.info("creating chat21 group for request with id: " + requestObj._id);

                        // winston.info("requestObj.participants: "+ Object.prototype.toString.call(requestObj.participants));
                        winston.debug("requestObj.participants: "+ JSON.stringify(requestObj.participants));
                        
                        let members = requestObj.participants;
                        // var members = reqParticipantArray;

                        members.push("system");
                        if (request.lead) {
                            members.push(request.lead.lead_id);
                        }
                        
                        
                        // let membersArray = JSON.parse(JSON.stringify(members));
                        // winston.info("membersArray", membersArray);

                        var gAttributes = request.attributes || {};
                        // problema requester_id
                        gAttributes["requester_id"] = request.requester_id;
                    
                       
                        gAttributes['projectId'] = request.id_project; //used by ionic to open request detail 

                        if (request.lead) {
                            gAttributes['userFullname'] = request.lead.fullname; //used by ionic to open request detail 
                            gAttributes['userEmail'] = request.lead.email; //used by ionic to open request detail 
                            // TOOD is it necessary? 
                            gAttributes['senderAuthInfo'] = {authType: "USER", authVar: {uid:request.lead.lead_id}}; //used by ionic otherwise ionic dont show userFullname in the participants panel
                        }
                        // TODO ionic dont show attributes panel if attributes.client is empty. bug?
                        gAttributes['client'] = request.userAgent || 'n.d.'; //used by ionic to open request detail 
                        gAttributes['departmentId'] = request.department._id; //used by ionic to open request detail 
                        gAttributes['departmentName'] = request.department.name; //used by ionic to open request detail 
                        gAttributes['sourcePage'] = request.sourcePage; //used by ionic to open request detail 

                        
                        // https://stackoverflow.com/questions/42310950/handling-undefined-values-with-firebase/42315610
                        var requestWithoutUndefined = JSON.parse(JSON.stringify(request, function(k, v) {
                            if (v === undefined) { return null; } return v; 
                         }));
                         gAttributes['_request'] = requestWithoutUndefined; //used by ionic to open request detail 
                        
                        


 
                        winston.debug("Chat21 group create gAttributes: ",gAttributes);  

                        var groupId = request.request_id;

                        var group_name = "Guest"; 

                        if (request.lead && request.lead.fullname) {
                            group_name = request.lead.fullname;
                        }
                        if (request.subject) {
                            group_name = request.subject;
                        }

                        console.log("setTimeout0")
                        setTimeout(function() {
                            console.log("setTimeout1");

                            return chat21.groups.create(group_name, members, gAttributes, groupId).then(function(data) {
                                winston.info("Chat21 group created: " + JSON.stringify(data));      
                                chat21Event.emit('group.create', data);                                          
                            }).catch(function(err) {
                                winston.error("Error creating chat21 group ", err);
                                chat21Event.emit('group.create.error', err);
                            });
                            
                        }, 20000);
                       


                    }
                // });
            });
    
            requestEvent.on('request.close',  function(request) {          

                setImmediate(() => {
                    if (request.channel.name === ChannelConstants.CHAT21) {

                        chat21.auth.setAdminToken(adminToken);                      

                        winston.info("Chat21Sender archiving conversations for ",request.participants);

                       //iterate request.participant and archive conversation
                       request.participants.forEach(function(participant,index) {

                        winston.info("Chat21Sender archiving conversation: " + request.request_id + "for " + participant);

                            chat21.conversations.archive(request.request_id, participant)
                                        .then(function(data){
                                            winston.info("Chat21 conversation archived result "+ JSON.stringify(data));
                                    
                                            chat21Event.emit('conversation.archived', data);                                               

                                }).catch(function(err) {
                                    winston.error("Chat21 archived err", err);
                                    chat21Event.emit('conversation.archived.error', err);
                                });
                       });

                    //    archive: function(recipient_id, user_id){
                       chat21.conversations.archive(request.request_id, "system")
                       .then(function(data){
                           winston.info("Chat21 archived ", JSON.stringify(data));
                   
                           chat21Event.emit('conversation.archived', data);                                               

                        }).catch(function(err) {
                            winston.error("Chat21 archived err", err);
                            chat21Event.emit('conversation.archived.error', err);
                        });

                        
                        //  request.lead can be undefined because some test case uses the old deprecated method requestService.createWithId.
                        if (request.lead) {
                            chat21.conversations.archive(request.request_id, request.lead.lead_id)  //                        chat21.conversations.archive(request.request_id, request.requester_id)<-desnt'archive

                            .then(function(data){
                                winston.info("Chat21 archived ", JSON.stringify(data));
                        
                                chat21Event.emit('conversation.archived', data);                                               
     
                             }).catch(function(err) {
                                 winston.error("Chat21 archived err", err);
                                 chat21Event.emit('conversation.archived.error', err);
                             });
                        }
                        
                    }
                });
            });
            
            

             requestEvent.on('request.participants.update',  function(data) {       
                   let request = data.request;
                   let removedParticipants = data.removedParticipants;
                

                setImmediate(() => {
                    if (request.channel.name === ChannelConstants.CHAT21) {

                        chat21.auth.setAdminToken(adminToken);

                        

                     
                        let requestObj = request.toJSON();
                        
                        winston.info("joining chat21 group for request with id: " + requestObj._id);
                    
                        var groupId = request.request_id;

                        let members = [];
                        
                        members.push("system");

                        // qui errore participants sembra 0,1 object ???
                        request.participants.forEach(function(participant,index) {
                            members.push(participant);
                        });
                        // requestObj.participants;
                        // var members = reqParticipantArray;

                        if (request.lead) {
                            members.push(request.lead.lead_id);
                        }
                        winston.info("Chat21 group with members: " , members);  

                         //setMembers: function(members, group_id){
                        chat21.groups.setMembers(members, groupId).then(function(data) {
                                winston.info("Chat21 group set: " , JSON.stringify(data));      
                                chat21Event.emit('group.setMembers', data);                                          
                            }).catch(function(err) {
                                winston.error("Error joining chat21 group ", err);
                                chat21Event.emit('group.setMembers.error', err);
                            });


                        // let oldParticipants = data.beforeRequest.participants;
                        // winston.info("oldParticipants ", oldParticipants);

                        // let newParticipants = data.request.participants;
                        // winston.info("newParticipants ", newParticipants);

                        // var removedParticipants = oldParticipants.filter(d => !newParticipants.includes(d));
                        // winston.info("removedParticipants ", removedParticipants);

                       

                        removedParticipants.forEach(function(removedParticipant) {
                            winston.info("removedParticipant ", removedParticipant);

                            // archive: function(recipient_id, user_id){
                            chat21.conversations.archive(request.request_id, removedParticipant)
                            .then(function(data){
                                winston.info("Chat21 archived ", JSON.stringify(data));
                        
                                chat21Event.emit('conversation.archived', data);                                               
        
                                }).catch(function(err) {
                                    winston.error("Chat21 archived err", err);
                                    chat21Event.emit('conversation.archived.error', err);
                                });

                        });
                        



                    }
                });
            });
            
            
               requestEvent.on('request.participants.join',  function(data) {       
                   let request = data.request;
                   let member = data.member;

                setImmediate(() => {
                    if (request.channel.name === ChannelConstants.CHAT21) {

                        chat21.auth.setAdminToken(adminToken);

                        

                     
                        // let requestObj = request.toJSON();
                        
                        var groupId = request.request_id;

                        winston.info("joining member " + member +" for chat21 group with request : " + groupId);
                                            

                         //join: function(member_id, group_id){
                        chat21.groups.join(member, groupId).then(function(data) {
                                winston.info("Chat21 group joined: " + JSON.stringify(data));      
                                chat21Event.emit('group.join', data);                                          
                            }).catch(function(err) {
                                winston.error("Error joining chat21 group ", err);
                                chat21Event.emit('group.join.error', err);
                            });



                    }
                });
            });
            
            
               requestEvent.on('request.participants.leave',  function(data) {       
                   let request = data.request;
                   let member = data.member;

                setImmediate(() => {
                    if (request.channel.name === ChannelConstants.CHAT21) {

                        chat21.auth.setAdminToken(adminToken);

                     

                     
                        // let requestObj = request.toJSON();
                        
                        var groupId = request.request_id;

                        winston.info("leaving " + member +" for chat21 group for request with id: " + groupId);
                                   

                         //leave: function(member_id, group_id){
                        chat21.groups.leave(member, groupId).then(function(data) {
                                winston.info("Chat21 group leaved: " + JSON.stringify(data));      
                                chat21Event.emit('group.leave', data);                                          
                            }).catch(function(err) {
                                winston.error("Error leaving chat21 group ", err);
                                chat21Event.emit('group.leave.error', err);
                            });


                            // anche devi archiviare la conversazione per utente corrente 

                            chat21.conversations.archive(request.request_id, member)
                            .then(function(data){
                                winston.info("Chat21 archived ", JSON.stringify(data));
                        
                                chat21Event.emit('conversation.archived', data);                                               
     
                             }).catch(function(err) {
                                 winston.error("Chat21 archived err", err);
                                 chat21Event.emit('conversation.archived.error', err);
                             });

                           


                    }
                });
            })
            




            groupEvent.on('group.create',  function(group) {                       

                if (process.env.SYNC_CHAT21_GROUPS !=="true") {
                    winston.info("Sync Tiledesk to Chat21 groups disabled");
                    return;
                }

                winston.info("Creating chat21 group", group);
                
                setImmediate(() => {

                    chat21.auth.setAdminToken(adminToken);


                    var groupMembers = group.members;
                    winston.info("groupMembers ", groupMembers); 
                    
                    return chat21.groups.create(group.name, groupMembers, undefined, group._id).then(function(data) {
                        winston.info("Chat21 group created: " + JSON.stringify(data));      
                        chat21Event.emit('group.create', data);                                          
                    }).catch(function(err) {
                        winston.error("Error creating chat21 group ", err);
                        chat21Event.emit('group.create.error', err);
                    });

                });

             });


             groupEvent.on('group.update',  function(group) {                       

                if (process.env.SYNC_CHAT21_GROUPS !=="true") {
                    winston.info("Sync Tiledesk to Chat21 groups disabled");
                    return;
                }

                winston.info("Updating chat21 group", group);
                
                setImmediate(() => {

                    chat21.auth.setAdminToken(adminToken);


                    var groupMembers = group.members;
                    winston.info("groupMembers ", groupMembers); 
                    
                    // chat21.groups.update(groupName, undefined, undefined, request.request_id).then(function(data) {

                        // setMembers: function(members, group_id){
                            // update: function(name, owner, attributes, group_id){
                    return chat21.groups.update(group.name, undefined, undefined, group._id).then(function(data) {
                        winston.info("Chat21 group updated: " + JSON.stringify(data));      
                        chat21Event.emit('group.update', data);     
                        return chat21.groups.setMembers(groupMembers, group._id).then(function(data) {      
                            winston.info("Chat21 group set: " , JSON.stringify(data));      
                            chat21Event.emit('group.setMembers', data);          
                        }).catch(function(err) {
                            winston.error("Error setMembers chat21 group ", err);
                            chat21Event.emit('group.setMembers.error', err);
                        });                             
                    }).catch(function(err) {
                        winston.error("Error creating chat21 group ", err);
                        chat21Event.emit('group.update.error', err);
                    });

                });

             });





             groupEvent.on('group.delete',  function(group) {                       

                if (process.env.SYNC_CHAT21_GROUPS !=="true") {
                    winston.info("Sync Tiledesk to Chat21 groups disabled");
                    return;
                }

                winston.info("Deleting chat21 group", group);
                
                setImmediate(() => {

                    chat21.auth.setAdminToken(adminToken);
                  
                    //Remove members but group remains.

                    return chat21.groups.setMembers(["system"], group._id).then(function(data) {      
                        winston.info("Chat21 group set: " , JSON.stringify(data));      
                        chat21Event.emit('group.setMembers', data);          
                    }).catch(function(err) {
                        winston.error("Error setMembers chat21 group ", err);
                        chat21Event.emit('group.setMembers.error', err);
                    });           

                });

             });

    }

    
}

var chat21Handler = new Chat21Handler();
module.exports = chat21Handler;