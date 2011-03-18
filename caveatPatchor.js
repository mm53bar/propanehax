var displayAvatars = true;

if (displayAvatars) {

  Object.extend(Campfire.Message.prototype, {
    authorID: function() {
      if (Element.hasClassName(this.element, 'you'))
        return this.chat.userID;

      var idtext = (this.element.className.match(/\s*user_(\d+)\s*/) || [])[1]; 
      return parseInt(idtext) || 0;
    },

    addAvatar: function() {
      var
        author = this.authorElement(),
        body = this.bodyCell,
        avatar, name, imgSize = 32, img;

      // avatar = author.getAttribute('data-avatar') || 'http://asset1.37img.com/global/missing/avatar.png?r=3';
      avatar = 'http://globase.heroku.com/redirect/gh.gravatars.' + this.authorID() + '?default=https://github.com/images/gravatars/gravatar-140.png';
      name = '<strong style="color:#333;">'+author.textContent+'</strong>'

      if (['enter','kick'].include(this.kind)) {
        imgSize = 16
        body = body.select('div:first')[0]
        name += ' '
      } else if (this.actsLikeTextMessage()) {
        name += '<br>'
      } else {
        return;
      }

      img = '<img alt="'+this.author()+'" width="'+imgSize+'" height="'+imgSize+'" align="absmiddle" style="opacity: 1.0; margin: 0px; border-radius:3px" src="'+avatar+'">'

      if (['enter','kick'].include(this.kind)) {
        name = img + '&nbsp;&nbsp;' + name;
        img = ''
      }

      if (author.visible()) {
        author.hide();

        if (body.select('strong').length === 0) {
          body.insert({top: name});
          if (img)
            author.insert({after: img});
        }
      }
    }
  });

  /* if you can wrap rather than rewrite, use swizzle like this: */
  swizzle(Campfire.Message, {
    setAuthorVisibilityInRelationTo: function($super, message) {
      $super(message);
      this.addAvatar();
    },
    authorElement: function($super) {
      if (this.kind == 'enter' || this.kind == 'kick') {
        return $super().select('span.author')[0]
      } else {
        return $super()
      }
    }
  });


  /* defining a new responder is probably the best way to insulate your hacks from Campfire and Propane */
  Campfire.AvatarMangler = Class.create({
    initialize: function(chat) {
      this.chat = chat;

      var messages = this.chat.transcript.messages;
      for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        message.addAvatar();
      }

      this.chat.layoutmanager.layout();
      this.chat.windowmanager.scrollToBottom();
    },

    onMessagesInserted: function(messages) {
      var scrolledToBottom = this.chat.windowmanager.isScrolledToBottom();

      for (var i = 0; i < messages.length; i++) {
        var message = messages[i];
        message.addAvatar();
      }

      if (scrolledToBottom) {
        this.chat.windowmanager.scrollToBottom();
      }
    }
  });

  /* Here is how to install your responder into the running chat */
  Campfire.Responders.push("AvatarMangler");
  window.chat.installPropaneResponder("AvatarMangler", "avatarmangler");
}

if (true) {
  Campfire.MeatbagExpander = Class.create({
    initialize: function(chat) {
      this.chat = chat;
      var messages = this.chat.transcript.messages;
      for (var i = 0; i < messages.length; i++) {
        this.detectMeatbags(messages[i]);
      }
      this.chat.windowmanager.scrollToBottom();
    },

    detectMeatbags: function(message) {
      /* we are going to use the messageID to uniquely identify our requestJSON request
         so we don't check pending messages */
      if (!message.pending() && message.kind === 'text') {
        var text = message.bodyElement().innerHTML;
        if (text.match(/^Office meatbags/)) {
          var names = text.match(/meatbags: (.+)$/)[1].split(', ')
          var pics = []

          for (var i=0; i < names.length; i++) {
            var name = names[i];
            name = name.replace(/\s+/g,'').toLowerCase()
            avatar = 'http://globase.heroku.com/redirect/gh.gravatars.' + name + '?default=https://github.com/images/gravatars/gravatar-140.png';
            pics.push('<img alt="'+name+'" width="32" height="32" align="middle" style="margin-right: 1px; opacity: 1.0; border-radius:3px" src="'+avatar+'">')
          }

          message.bodyElement().update("" + pics.join(''))
        }
      }
    },

    onMessagesInsertedBeforeDisplay: function(messages) {
      var scrolledToBottom = this.chat.windowmanager.isScrolledToBottom();
      for (var i = 0; i < messages.length; i++) {
        this.detectMeatbags(messages[i]);
      }
      if (scrolledToBottom) {
        this.chat.windowmanager.scrollToBottom();
      }
    }
  });

  Campfire.Responders.push("MeatbagExpander");
  window.chat.installPropaneResponder("MeatbagExpander", "meatbagexpander");
}

if (true) {
  Campfire.GitHubExpander = Class.create({
    initialize: function(chat) {
      this.chat = chat;
      var messages = this.chat.transcript.messages;
      for (var i = 0; i < messages.length; i++) {
        this.detectGitHubURL(messages[i]);
      }
      this.chat.windowmanager.scrollToBottom();
    },

    detectGitHubURL: function(message) {
      /* we are going to use the messageID to uniquely identify our requestJSON request
         so we don't check pending messages */
      if (!message.pending() && message.kind === 'text') {
        var iframe = null, elem, height = 150;

        var gists = message.bodyElement().select('a[href*="gist.github.com"]');
        if (gists.length == 1) {
          elem = gists[0];
          var href = elem.getAttribute('href');
          var match = href.match(/^https?:\/\/gist.github.com\/([A-Fa-f0-9]+)/);
          if (match) {
            iframe = 'https://gist.github.com/'+match[1]+'.pibb';
          }
        }

        var blobs = message.bodyElement().select('a[href*="#L"]');
        if (blobs.length == 1) {
          elem = blobs[0];
          var href = elem.getAttribute('href');
          iframe = href;
        }

        var blobs = message.bodyElement().select('a[href*="/blob/"]');
        if (!iframe && blobs.length == 1) {
          elem = blobs[0];
          var href = elem.getAttribute('href');
          iframe = href + '#L1';
        }

        // var commits = message.bodyElement().select('a[href*=/commit/]')
        // if (commits.length == 1) {
        //   elem = commits[0];
        //   var href = elem.getAttribute('href');
        //   iframe = href + '#toc';
        // }

        if (!iframe) return;
        message.bodyElement().insert({bottom:"<iframe style='border:0; margin-top: 5px' height='"+height+"' width='98%' src='"+iframe+"'></iframe>"});
      }
    },

    onMessagesInsertedBeforeDisplay: function(messages) {
      var scrolledToBottom = this.chat.windowmanager.isScrolledToBottom();
      for (var i = 0; i < messages.length; i++) {
        this.detectGitHubURL(messages[i]);
      }
      if (scrolledToBottom) {
        this.chat.windowmanager.scrollToBottom();
      }
    },

    onMessageAccepted: function(message, messageID) {
      this.detectGitHubURL(message);
    }
  });

  Campfire.Responders.push("GitHubExpander");
  window.chat.installPropaneResponder("GitHubExpander", "githubexpander");
}

if (true) {
  Campfire.CommitExpander = Class.create({
    initialize: function(chat) {
      this.chat = chat;
      var messages = this.chat.transcript.messages;
      for (var i = 0; i < messages.length; i++) {
        this.detectCommit(messages[i]);
      }
    },

    detectCommit: function(message) {
      if (!message.pending() && message.kind === 'text') {
        var body = message.bodyElement()
        if (body.innerText.match(/^\[[\w-\.]+(\/|\])/) || body.innerText.match(/(is deploying|deployment of)/)) {
          message.bodyCell.setStyle({
            color: '#888888'
          })
        }
      }
    },

    onMessagesInsertedBeforeDisplay: function(messages) {
      for (var i = 0; i < messages.length; i++) {
        this.detectCommit(messages[i]);
      }
    }
  });

  Campfire.Responders.push("CommitExpander");
  window.chat.installPropaneResponder("CommitExpander", "commitexpander");
}

if (true) {
  Campfire.BuildExpander = Class.create({
    initialize: function(chat) {
      this.chat = chat;
      var messages = this.chat.transcript.messages;
      for (var i = 0; i < messages.length; i++) {
        this.detectBuild(messages[i]);
      }
    },

    detectBuild: function(message) {
      if (!message.pending() && message.kind === 'text') {
        var body = message.bodyElement()
        if (body.innerText.match(/^Build #(\d+) \([0-9a-zA-Z]+\) of (github-)?([-_0-9a-zA-Z]+)/)) {
          var failed_p = body.innerText.match(/failed/);
          message.bodyCell.setStyle({
            color: failed_p ? '#ff0000' : '#00941f',
            fontWeight: 'bold'
          })

          body.replace(body.outerHTML.replace(/#(\d+) \(([0-9a-zA-Z]+)\) of (?:github-)?([-_0-9a-zA-Z]+)/, '<a target="_blank" href="http://ci2.rs.github.com:8080/job/github-$3/$1/console">#$1</a> ($2) of github-$3'));
        }
      }
    },

    onMessagesInsertedBeforeDisplay: function(messages) {
      for (var i = 0; i < messages.length; i++) {
        this.detectBuild(messages[i]);
      }
    }
  });

  Campfire.Responders.push("BuildExpander");
  window.chat.installPropaneResponder("BuildExpander", "buildexpander");
}

if (true) {
  Campfire.DiffExpander = Class.create({
    initialize: function(chat) {
      this.chat = chat;
      var messages = this.chat.transcript.messages;
      for (var i = 0; i < messages.length; i++) {
        this.detectDiff(messages[i]);
      }
      this.chat.windowmanager.scrollToBottom();
    },

    detectDiff: function(message) {
      if (!message.pending() && message.kind === 'paste') {
        var code = message.bodyCell.select('pre code')
        if (code.length) {
          var diff = code[0].innerText
          if (diff.match(/^\+\+\+/m)) {
            var lines = diff.split("\n").map(function(line){
              if (line.match(/^(diff|index)/)) {
                return "<b>"+line.escapeHTML()+"</b>"
              } else if (match = line.match(/^(@@.+?@@)(.*)$/)) {
                return "<b>"+match[1]+"</b> " + match[2].escapeHTML()
              } else if (line.match(/^\+/)) {
                return "<font style='color:green'>"+line.escapeHTML()+"</font>"
              } else if (line.match(/^\-/)) {
                return "<font style='color:red'>"+line.escapeHTML()+"</font>"
              } else {
                return line.escapeHTML()
              }
            })
            code[0].innerHTML = lines.join("\n")
          }
        }
      }
    },

    onMessagesInsertedBeforeDisplay: function(messages) {
      var scrolledToBottom = this.chat.windowmanager.isScrolledToBottom();
      for (var i = 0; i < messages.length; i++) {
        this.detectDiff(messages[i]);
      }
      if (scrolledToBottom) {
        this.chat.windowmanager.scrollToBottom();
      }
    },

    onMessageAccepted: function(message, messageID) {
      this.detectDiff(message);
    }
  });

  Campfire.Responders.push("DiffExpander");
  window.chat.installPropaneResponder("DiffExpander", "diffexpander");
}

if (true) {
  Campfire.HTMLExpander = Class.create({
    initialize: function(chat) {
      this.chat = chat;
      // var messages = this.chat.transcript.messages;
      // for (var i = 0; i < messages.length; i++) {
      //   this.detectHTML(messages[i]);
      // }
      // this.chat.windowmanager.scrollToBottom();
    },

    detectHTML: function(message) {
      if (!message.pending() && ['text','paste'].include(message.kind)) {
        var body = message.bodyElement()
        var match = body.innerText.match(/^HTML!\s+(.+)$/m);
        if (match && !body.innerText.match(/<\s*script/)) {
          body.update(match[1])
        }
      }
    },

    onMessagesInsertedBeforeDisplay: function(messages) {
      var scrolledToBottom = this.chat.windowmanager.isScrolledToBottom();
      for (var i = 0; i < messages.length; i++) {
        this.detectHTML(messages[i]);
      }
      if (scrolledToBottom) {
        this.chat.windowmanager.scrollToBottom();
      }
    },

    onMessageAccepted: function(message, messageID) {
      this.detectHTML(message);
    }
  });

  Campfire.Responders.push("HTMLExpander");
  window.chat.installPropaneResponder("HTMLExpander", "htmlexpander");
}

window.chat.messageHistory = 800;

// var $focused = true;
// window.onfocus = function(){ alert(1); $focused = true  }
// window.onblur  = function(){ $focused = false }

// swizzle(Campfire.WindowManager, {
//   isScrolledToBottom: function($super) {
//     return $focused ? $super() : false;
//   }
// });
//
