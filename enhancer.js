if (window.propane || true) {

  /* This is the same as Campfire's inbuild augment() function that is defined for mobile safari*/
  function swizzle(klass, methods) {
    var wrappedMethods = {}, methodName;
    for (methodName in methods) {
      wrappedMethods[methodName] = klass.prototype[methodName].wrap(methods[methodName]);
    }
    klass.addMethods(wrappedMethods);
  }

  Object.extend(Campfire.Chat.prototype, {
    installPropaneResponder: function(responderClassName, responderName) {
      if (this[responderName] == null) {
        this[responderName] = new Campfire[responderClassName](this);
        this.listeners.push(this[responderName]);
      }
    },
  });

  Object.extend(Campfire.Message.prototype, {
    authorDataName: function () {
      var dataNameProvider = this.authorCell.querySelector('span.author');
      if (dataNameProvider != null) {
        return dataNameProvider.getAttribute('data-name');
      }
      return null;
    },
  });

  Object.extend(Campfire.LayoutManager.prototype, {
    getChatAuthorColumnWidth: function() {
      var element = this.firstVisibleMessageBodyElement();
      if (!element) return 0;
      return Position.cumulativeOffset(element)[0] -
        Position.cumulativeOffset(this.chat.transcript.element)[0];
    },
    firstVisibleMessageBodyElement: function() {
      var messages = this.chat.transcript.messages;
      for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        if (!message.element.hasClassName('propane_hidden_enterleave') && message.element.visible()) {
          return message.element.getElementsByTagName('td')[1];
        }
      }
      return null;
    }
  });

  Object.extend(Campfire.SoundManager.prototype, {
    play: function(sound, force) {
      if (!force) return;
      window.propane.playCampfireSound(sound);
    }
  });

  Object.extend(Campfire.Transcript.prototype, {
    highlightMessageByID: function(message_id) {
      try {
        var cell = this.bodyCellByMessageID(message_id);
        if (cell != null) {
          cell.visualEffect("highlight", { duration: 2 });
        }
      } catch (e) {
      }
    },
    bodyCellByMessageID: function(message_id) {
      try {
        var message = this.getMessageById(message_id);
        if (message != null) {
          return message.bodyCell;
        }
      } catch (e) {
      }
      return null;
    }
  });

  Campfire.PropaneResponder = Class.create({
    initialize: function(chat) {
      this.chat = chat;
      this.shouldForceScrollToBottom = true;

      var messages = this.chat.transcript.messages;
      for (var i = 0; i < messages.length; i++) {
        this.fixSoundMessage(messages[i]);
      }
    },
    authorID: function(message) {
      if (Element.hasClassName(message.element, 'you'))
        return this.chat.userID;

      var idtext = (message.element.className.match(/\s*user_(\d+)\s*/) || [])[1]; 
      return parseInt(idtext) || 0;
    },
    onPropaneTabWillStartLiveResize: function() {
      this.noteBottomScrollPosition();
    },
    onPropaneTabDidEndLiveResize: function() {
      this.restoreNotedBottomScrollPosition();
    },
    onPropaneTabDidGainFocus: function() {
      this.restoreNotedBottomScrollPosition();
    },
    onPropaneTabWillLoseFocus: function() {
      this.noteBottomScrollPosition();
    },
    onPropaneToggledFullScreen: function(inFullScreen) {
      this.chat.layoutmanager.layout();
      this.chat.windowmanager.scrollToBottom();
    },
    onPropaneChangedTextZoomFactor: function() {
      /* By the time we fire, the current scroll-to-bottom state may be pants. Use the recorded one instead */
      var scrolledToBottom = this.chat.windowmanager.scrolledToBottom;
      this.chat.layoutmanager.layout();
      if (scrolledToBottom) {
        this.chat.windowmanager.scrollToBottom();
      }
    },
    onMessageAccepted: function(element, messageID) {
      this.fixSoundMessage(element);
      window.propane.messageAccepted(messageID);
    },
    onMessagesInsertedBeforeDisplay: function(messages) {
      for (var i = 0; i < messages.length; i++) {
        this.fixSoundMessage(messages[i]);
      }
      if (!window.propane.hideEnterLeaveMessages()) {
        return;
      }
      if (!window.propane.notifyEnterLeaveMessages()) {
        this.hideEnterLeaveForMessages(messages);
        return;
      }
      if (this.lastHiddenTimestamp && messages[0].kind != 'timestamp') {
        this.lastHiddenTimestamp.element.removeClassName('propane_hidden_enterleave');
      }
      this.lastHiddenTimestamp = null;
      this.lastVisibleTimestamp = null;
    },
    onMessagesInserted: function(messages) {
      for (var i = 0; i < messages.length; i++) {
        var message = messages[i];

        var body;
        try {
          if (message.kind == "upload") {
            body = message.bodyCell.querySelector("a").getAttribute('href');
          }
          else if (message.kind == "sound") {
            body = message.getSound();
          }
          else {
            var bodyElement = message.bodyElement();
            var bodyElementImage = bodyElement.querySelector("img");
            if (message.kind == "text" && bodyElementImage != null) {
              body = bodyElementImage.src;
            } else {
              body = bodyElement.textContent;
            }
          }
        } catch (e) {
          body = "";
        }
        
        var authorText = null;
        if (message.kind != 'timestamp') {
          authorText = message.authorDataName() || message.authorElement().textContent;
        }
        
        window.propane.messageInserted(message.id(), this.authorID(message), authorText, message.kind,  body);
      }
    },
    noteBottomScrollPosition: function() {
      if (!this.shouldForceScrollToBottom) {
        this.shouldForceScrollToBottom = this.chat.windowmanager.isScrolledToBottom();
      }
    },
    restoreNotedBottomScrollPosition: function() {
      if (this.shouldForceScrollToBottom) {
        this.chat.windowmanager.scrollToBottom();
      }
      this.shouldForceScrollToBottom = false;
    },
    hideEnterLeave: function() {
      this.lastVisibleTimestamp = null;
      this.lastHiddenTimestamp = null;
      var messages = this.chat.transcript.messages;
      this.hideEnterLeaveForMessages(messages);
    },
    noteVisibleTimestamp: function(timestampMessage) {
      timestampMessage.setAuthorVisibilityInRelationTo(this.lastVisibleTimestamp);
      timestampMessage.element.removeClassName('propane_hidden_enterleave');
      this.lastVisibleTimestamp = timestampMessage;
      this.lastHiddenTimestamp = null;
    },
    noteHiddenTimestamp: function(timestampMessage) {
      timestampMessage.element.addClassName('propane_hidden_enterleave');
      this.lastHiddenTimestamp = timestampMessage;
    },
    hideEnterLeaveForMessages: function(messages) {
      var latestTimestamp = null;
      var stampable = false;

      if (this.lastHiddenTimestamp) {
        latestTimestamp = this.lastHiddenTimestamp;
      } else if (this.lastVisibleTimestamp) {
        latestTimestamp = this.lastVisibleTimestamp;
        stampable = true;
      }

      for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        if (message.kind == 'timestamp') {
          if (latestTimestamp) {
            if (stampable) {
              this.noteVisibleTimestamp(latestTimestamp);
            } else {
              this.noteHiddenTimestamp(latestTimestamp);
            }
          }
          latestTimestamp = message;
          stampable = false;
        } else if (message.kind == 'enter' || message.kind == 'leave' || message.kind == 'kick') {
          message.element.addClassName('propane_hidden_enterleave');
        } else {
          stampable = true;
        }
      }
      if (latestTimestamp) {
        if (stampable) {
          this.noteVisibleTimestamp(latestTimestamp);
        } else {
          this.noteHiddenTimestamp(latestTimestamp);
        }
      }
      this.chat.layoutmanager.layout();
    },
    showEnterLeave: function() {
      var scrolledToBottom = this.chat.windowmanager.isScrolledToBottom();
      this.lastVisibleTimestamp = null;
      this.lastHiddenTimestamp = null;
      var latestTimestamp = null;
      var messages = this.chat.transcript.messages;
      for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        if (message.kind == 'timestamp') {
          message.setAuthorVisibilityInRelationTo(latestTimestamp);
          message.element.removeClassName('propane_hidden_enterleave');
          latestTimestamp = message;
        } else if (message.kind == 'enter' || message.kind == 'leave' || message.kind == 'kick') {
          message.element.removeClassName('propane_hidden_enterleave');
        }
      }

      this.chat.layoutmanager.layout();

      if (scrolledToBottom) {
        this.chat.windowmanager.scrollToBottom();
      }
    },
    fixSoundMessage: function(message) {
      if (!message.pending() && message.kind === 'sound') {
        var links = message.bodyElement().select('a');
        if (links.length < 1) {
          return;
        }
        var href = links[0].getAttribute('href');
        var clickHandler = links[0].getAttribute('onclick');

        for (var i = 1; i < links.length; i++) {
          links[i].setAttribute('href', href);
          links[i].setAttribute('onclick', clickHandler);
          links[i].removeAttribute('target');
        }
      }
    }
  });

  /* 
    Want to be notified as soon as participants change - DOM mutation events
    are a pain in the arse because they get fired too soon and too often.
    So I'm going to be evil instead.
  */
  Ajax.Responders.register({
    onComplete: function(response){
      try {
        var responseText = response.transport.responseText;
        if (responseText != null && responseText.match(/Element.update\("participants"/)) {
          window.propane.participantsUpdated();
        } else if (responseText != null && responseText.match(/Element.update\("conference_control"/)) {
          window.propane.conferenceUpdated();
        }
      } catch (e) {
        // do nothing
      }
    }
  });

  Campfire.Responders.push("PropaneResponder");
  window.chat.installPropaneResponder("PropaneResponder", "propaneresponder");

}
