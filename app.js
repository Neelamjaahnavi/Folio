// ╔══════════════════════════════════════════════════════════╗
// ║   FOLIO — Portfolio Builder  v7                          ║
// ║   Clean, no AI. All features polished.                   ║
// ║   Storage: IndexedDB for media, localStorage for text    ║
// ╚══════════════════════════════════════════════════════════╝

angular.module('portfolioApp', [])

/* ── filters ── */
.filter('replace', function () {
  return function (str, from, to) {
    return str ? String(str).split(from).join(to) : '';
  };
})
.filter('trustUrl', ['$sce', function ($sce) {
  return function (url) { return $sce.trustAsResourceUrl(url || ''); };
}])

/* ══════════════════════════════════════════
   SKILL-INPUT DIRECTIVE  (pure DOM — no ng-model timing bugs)
══════════════════════════════════════════ */
.directive('skillInput', function () {
  return {
    restrict: 'E',
    scope: { skills: '=' },
    template:
      '<div class="tags-wrap" ng-class="{focused:focused}">' +
        '<span class="tag" ng-repeat="s in skills track by $index">' +
          '{{s}}<button type="button" ng-click="rm($index);$event.stopPropagation()">×</button>' +
        '</span>' +
        '<input class="skill-inline-input" type="text" ' +
          'placeholder="{{skills&&skills.length?\'Add more…\':\'Type a skill, press Enter or ,\'}}" ' +
          'ng-focus="focused=true" ng-blur="focused=false"/>' +
      '</div>' +
      '<div class="skill-hint">Press <strong>Enter</strong> or <strong>,</strong> to add · <strong>Backspace</strong> on empty removes last</div>',
    link: function (scope, el) {
      var inp = el[0].querySelector('input');
      function commit (raw) {
        raw.split(',').forEach(function (p) {
          var s = p.trim();
          if (!s) return;
          if (!scope.skills) scope.skills = [];
          if (!scope.skills.some(function (x) { return x.toLowerCase() === s.toLowerCase(); }))
            scope.skills.push(s);
        });
        inp.value = '';
        scope.$apply();
      }
      inp.addEventListener('keydown', function (e) {
        var v = inp.value;
        if (e.key === 'Enter' || e.keyCode === 13) { e.preventDefault(); if (v.trim()) commit(v); }
        else if ((e.key === ',' || e.keyCode === 188) && v.trim()) { e.preventDefault(); commit(v); }
        else if ((e.key === 'Backspace' || e.keyCode === 8) && !v && scope.skills && scope.skills.length)
          scope.$apply(function () { scope.skills.pop(); });
      });
      el[0].querySelector('.tags-wrap').addEventListener('click', function (e) {
        if (e.target.tagName !== 'BUTTON') inp.focus();
      });
      scope.rm = function (i) { scope.skills.splice(i, 1); };
    }
  };
})

/* ══════════════════════════════════════════
   MEDIA-DB SERVICE  (IndexedDB — handles large images & videos)
══════════════════════════════════════════ */
.factory('MediaDB', ['$q', function ($q) {
  var DB_NAME    = 'folio_media_v7';
  var STORE_NAME = 'blobs';
  var db         = null;

  function open () {
    var d = $q.defer();
    if (db) { d.resolve(db); return d.promise; }
    var req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = function (e) { e.target.result.createObjectStore(STORE_NAME); };
    req.onsuccess = function (e) { db = e.target.result; d.resolve(db); };
    req.onerror   = function (e) { d.reject(e); };
    return d.promise;
  }

  function tx (mode, cb) {
    var d = $q.defer();
    open().then(function (database) {
      var t  = database.transaction(STORE_NAME, mode);
      var st = t.objectStore(STORE_NAME);
      cb(st, d);
    }, d.reject);
    return d.promise;
  }

  return {
    set: function (key, value) {
      return tx('readwrite', function (st, d) {
        var r = st.put(value, key);
        r.onsuccess = function () { d.resolve(); };
        r.onerror   = function (e) { d.reject(e); };
      });
    },
    get: function (key) {
      return tx('readonly', function (st, d) {
        var r = st.get(key);
        r.onsuccess = function () { d.resolve(r.result || null); };
        r.onerror   = function (e) { d.reject(e); };
      });
    },
    del: function (key) {
      return tx('readwrite', function (st, d) {
        st.delete(key); d.resolve();
      });
    }
  };
}])

/* ══════════════════════════════════════════
   MAIN CONTROLLER
══════════════════════════════════════════ */
.controller('AppCtrl', ['$scope', '$timeout', '$window', '$sce', '$q', 'MediaDB',
function ($scope, $timeout, $window, $sce, $q, MediaDB) {

  /* ── storage keys ── */
  var USERS_KEY   = 'folio_v7_users';
  var SESSION_KEY = 'folio_v7_session';
  var SHARES_KEY  = 'folio_v7_shares';
  var VIEWS_KEY   = 'folio_v7_views';

  /* ── theme palette ── */
  $scope.themeOptions = [
    { name:'Dark Gold',  bg:'linear-gradient(135deg,#1c1f28,#2a2000)' },
    { name:'Deep Blue',  bg:'linear-gradient(135deg,#0d1b2a,#1e3a5f)' },
    { name:'Forest',     bg:'linear-gradient(135deg,#0d2016,#1a3a2a)' },
    { name:'Crimson',    bg:'linear-gradient(135deg,#2a0d0d,#3a1a1a)' },
    { name:'Violet',     bg:'linear-gradient(135deg,#1a0d2e,#2e1a4f)' },
    { name:'Slate',      bg:'linear-gradient(135deg,#1c1f28,#13151a)' },
    { name:'Sunrise',    bg:'linear-gradient(135deg,#2a1500,#3a2200)' },
    { name:'Teal',       bg:'linear-gradient(135deg,#001a1f,#00303a)' },
  ];

  /* ── state ── */
  $scope.view             = 'landing';
  $scope.modal            = null;
  $scope.editorTab        = 'edit';
  $scope.currentUser      = null;
  $scope.auth             = {};
  $scope.reg              = {};
  $scope.authError        = '';
  $scope.regError         = '';
  $scope.toasts           = [];
  $scope.editingIndex     = null;
  $scope.editingPortfolio = null;
  $scope.newProject       = {};
  $scope.shareUrl         = '';
  $scope.shareTarget      = null;
  $scope.publicPortfolio  = null;
  $scope.activeProject    = null;
  $scope.dashSearch       = '';
  $scope.previewLight     = false;

  /* ════════════════════════════════════════
     STORAGE HELPERS
  ════════════════════════════════════════ */
  function loadUsers () {
    try { return JSON.parse(localStorage.getItem(USERS_KEY)) || []; }
    catch (e) { return []; }
  }
  function saveUsers (u) {
    try { localStorage.setItem(USERS_KEY, JSON.stringify(u)); return true; }
    catch (e) { return false; }
  }
  function saveSession (e) { localStorage.setItem(SESSION_KEY, e); }
  function clearSession ()  { localStorage.removeItem(SESSION_KEY); }

  /* ── Media key helpers ── */
  function mKey (pid, field, idx) {
    return pid + '_' + field + (idx !== undefined ? '_' + idx : '');
  }

  /* Strip blobs from portfolio before saving to localStorage */
  function stripMedia (p) {
    var c = angular.copy(p);
    c.avatarImg = null;
    if (c.projects) {
      c.projects = c.projects.map(function (pr) {
        var cp = angular.copy(pr); cp.image = null; cp.video = null; return cp;
      });
    }
    return c;
  }

  /* Save all media blobs to IndexedDB */
  function saveMediaToDB (portfolio) {
    if (!portfolio.id) return $q.resolve();
    var pid = portfolio.id;
    var promises = [MediaDB.set(mKey(pid, 'avatar'), portfolio.avatarImg || null)];
    (portfolio.projects || []).forEach(function (pr, i) {
      promises.push(MediaDB.set(mKey(pid, 'img', i), pr.image || null));
      promises.push(MediaDB.set(mKey(pid, 'vid', i), pr.video || null));
    });
    return $q.all(promises);
  }

  /* Load all blobs for a portfolio from IndexedDB */
  function loadMediaFromDB (portfolio) {
    if (!portfolio || !portfolio.id) return $q.resolve(portfolio);
    var pid = portfolio.id;
    var projectCount = (portfolio.projects || []).length;
    var keys = [mKey(pid, 'avatar')];
    for (var i = 0; i < projectCount; i++) {
      keys.push(mKey(pid, 'img', i));
      keys.push(mKey(pid, 'vid', i));
    }
    return $q.all(keys.map(function (k) { return MediaDB.get(k); }))
      .then(function (results) {
        portfolio.avatarImg = results[0] || null;
        for (var j = 0; j < projectCount; j++) {
          if (portfolio.projects[j]) {
            portfolio.projects[j].image = results[1 + j * 2]     || null;
            portfolio.projects[j].video = results[1 + j * 2 + 1] || null;
          }
        }
        return portfolio;
      })
      .catch(function () { return portfolio; });
  }

  function loadAllMedia (portfolios) {
    return $q.all((portfolios || []).map(loadMediaFromDB));
  }

  /* Persist stripped user record to localStorage */
  function persistCurrentUser () {
    var users = loadUsers();
    var idx = users.findIndex(function (u) { return u.email === $scope.currentUser.email; });
    if (idx === -1) return false;
    var lean = angular.copy($scope.currentUser);
    lean.portfolios = (lean.portfolios || []).map(stripMedia);
    var ok = saveUsers(users.map(function (u, i) { return i === idx ? lean : u; }));
    if (!ok) $scope.showToast('Storage full — try removing old portfolios.', 'error');
    return ok;
  }

  function genId () {
    return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  }

  /* ════════════════════════════════════════
     BOOT — restore session or parse share link
  ════════════════════════════════════════ */
  (function init () {
    var hash = $window.location.hash;
    if (hash && hash.indexOf('#p=') === 0) {
      var sid = hash.substring(3);
      try {
        var shares = JSON.parse(localStorage.getItem(SHARES_KEY)) || {};
        if (shares[sid]) {
          var pub = JSON.parse(shares[sid]);
          $scope.publicPortfolio = pub;
          $scope.view = 'public';
          bumpView(sid);
          loadMediaFromDB(pub).then(function (h) {
            $scope.$apply(function () { $scope.publicPortfolio = h; });
          });
          return;
        }
      } catch (e) {}
      $scope.publicPortfolio = null;
      $scope.view = 'public';
      return;
    }
    var email = localStorage.getItem(SESSION_KEY);
    if (email) {
      var users = loadUsers();
      var user  = users.find(function (u) { return u.email === email; });
      if (user) {
        $scope.currentUser = user;
        $scope.view = 'dashboard';
        loadAllMedia(user.portfolios).then(function (h) {
          $scope.$apply(function () { $scope.currentUser.portfolios = h; });
        });
      }
    }
  }());

  /* ════════════════════════════════════════
     TOASTS
  ════════════════════════════════════════ */
  $scope.showToast = function (msg, type) {
    var icons = { success:'✅', error:'❌', info:'ℹ️', warn:'⚠️' };
    var t = { msg:msg, type:type||'info', icon:icons[type]||'ℹ️' };
    $scope.toasts.push(t);
    $timeout(function () {
      var i = $scope.toasts.indexOf(t);
      if (i !== -1) $scope.toasts.splice(i, 1);
    }, 3400);
  };

  /* ════════════════════════════════════════
     MODALS
  ════════════════════════════════════════ */
  $scope.openModal = function (w) {
    $scope.modal = w;
    $scope.authError = $scope.regError = '';
    $scope.auth = {}; $scope.reg = {};
  };
  $scope.closeModal = function (evt) {
    if (!evt || evt.target === evt.currentTarget) {
      $scope.modal = null;
      $scope.activeProject = null;
      $timeout(function () {
        document.querySelectorAll('.popup-video').forEach(function (v) {
          try { v.pause(); } catch (e) {}
        });
      }, 50);
    }
  };

  /* ════════════════════════════════════════
     AUTH
  ════════════════════════════════════════ */
  $scope.register = function () {
    $scope.regError = '';
    var r = $scope.reg;
    if (!r.name     || r.name.trim().length < 2)                     { $scope.regError = 'Name must be at least 2 characters.'; return; }
    if (!r.username || r.username.trim().length < 3)                 { $scope.regError = 'Username must be at least 3 characters.'; return; }
    if (!r.email    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(r.email)) { $scope.regError = 'Enter a valid email address.'; return; }
    if (!r.password || r.password.length < 6)                        { $scope.regError = 'Password must be at least 6 characters.'; return; }
    var users = loadUsers();
    if (users.find(function (u) { return u.email    === r.email.toLowerCase(); }))    { $scope.regError = 'Email already in use.'; return; }
    if (users.find(function (u) { return u.username === r.username.toLowerCase(); })) { $scope.regError = 'Username already taken.'; return; }
    var nu = {
      name:r.name.trim(), username:r.username.trim().toLowerCase(),
      email:r.email.trim().toLowerCase(), password:r.password,
      portfolios:[], createdAt:new Date().toISOString()
    };
    users.push(nu);
    if (!saveUsers(users)) { $scope.regError = 'Storage error — please try again.'; return; }
    $scope.currentUser = nu;
    saveSession(nu.email);
    $scope.modal = null;
    $scope.view  = 'dashboard';
    $scope.showToast('Welcome to Folio, ' + nu.name + '! 🎉', 'success');
  };

  $scope.login = function () {
    $scope.authError = '';
    var a = $scope.auth;
    if (!a.email || !a.password) { $scope.authError = 'Please enter email and password.'; return; }
    var user = loadUsers().find(function (u) {
      return u.email === a.email.trim().toLowerCase() && u.password === a.password;
    });
    if (!user) { $scope.authError = 'Invalid email or password.'; return; }
    $scope.currentUser = user;
    saveSession(user.email);
    $scope.modal = null;
    $scope.view  = 'dashboard';
    $scope.showToast('Welcome back, ' + user.name + '!', 'success');
    loadAllMedia(user.portfolios).then(function (h) {
      $scope.$apply(function () { $scope.currentUser.portfolios = h; });
    });
  };

  $scope.logout = function () {
    var name = $scope.currentUser.name;
    $scope.currentUser = null;
    clearSession();
    $scope.view = 'landing';
    $scope.showToast('Goodbye, ' + name + '! 👋', 'info');
  };

  /* ════════════════════════════════════════
     NAVIGATION
  ════════════════════════════════════════ */
  $scope.goHome = function () {
    if ($window.location.hash) history.pushState('', document.title, $window.location.pathname);
    $scope.view = $scope.currentUser ? 'dashboard' : 'landing';
  };

  $scope.goToDashboard = function () {
    if ($scope.currentUser) {
      var fresh = loadUsers().find(function (u) { return u.email === $scope.currentUser.email; });
      if (fresh) {
        $scope.currentUser = fresh;
        loadAllMedia(fresh.portfolios).then(function (h) {
          $scope.$apply(function () { $scope.currentUser.portfolios = h; });
        });
      }
    }
    $scope.view = 'dashboard';
  };

  /* ════════════════════════════════════════
     PORTFOLIO CRUD
  ════════════════════════════════════════ */
  function blankPortfolio () {
    return {
      id:genId(), name:'', role:'', bio:'', location:'', experience:'',
      avatarImg:null, theme:'linear-gradient(135deg,#1c1f28,#2a2000)',
      skills:[], projects:[],
      email:$scope.currentUser.email, github:'', linkedin:'',
      createdAt:new Date().toISOString()
    };
  }

  $scope.newPortfolio = function () {
    $scope.editingPortfolio = blankPortfolio();
    $scope.editingIndex = null;
    $scope.newProject   = {};
    $scope.editorTab    = 'edit';
    $scope.previewLight = false;
    $scope.view         = 'editor';
  };

  $scope.openEditor = function (idx) {
    $scope.editingPortfolio = angular.copy($scope.currentUser.portfolios[idx]);
    $scope.editingIndex     = idx;
    $scope.newProject       = {};
    $scope.editorTab        = 'edit';
    $scope.previewLight     = false;
    $scope.view             = 'editor';
  };

  /* ── SAVE (IndexedDB first, then localStorage) ── */
  $scope.savePortfolio = function () {
    var p = $scope.editingPortfolio;
    if (!p.name || !p.name.trim()) { $scope.showToast('Please add a portfolio title.', 'error'); return; }
    if (!p.id) p.id = genId();
    if (!$scope.currentUser.portfolios) $scope.currentUser.portfolios = [];

    saveMediaToDB(p)
      .then(function () {
        var fullCopy = angular.copy(p);
        if ($scope.editingIndex !== null && $scope.editingIndex < $scope.currentUser.portfolios.length) {
          $scope.currentUser.portfolios[$scope.editingIndex] = fullCopy;
        } else {
          $scope.currentUser.portfolios.push(fullCopy);
          $scope.editingIndex = $scope.currentUser.portfolios.length - 1;
        }
        var ok = persistCurrentUser();
        $scope.$apply(function () {
          if (ok) $scope.showToast('"' + p.name + '" saved! ✨', 'success');
        });
      })
      .catch(function (err) {
        $scope.$apply(function () {
          $scope.showToast('Save failed: ' + (err && err.message || 'unknown error'), 'error');
        });
      });
  };

  $scope.deletePortfolio = function (idx) {
    if (idx < 0 || idx >= ($scope.currentUser.portfolios || []).length) return;
    var name = $scope.currentUser.portfolios[idx].name || 'Portfolio';
    if (!confirm('Delete "' + name + '"? This cannot be undone.')) return;
    $scope.currentUser.portfolios.splice(idx, 1);
    persistCurrentUser();
    $scope.showToast('"' + name + '" deleted.', 'info');
  };

  $scope.duplicatePortfolio = function (idx) {
    var copy = angular.copy($scope.currentUser.portfolios[idx]);
    copy.name      = copy.name + ' (Copy)';
    copy.id        = genId();
    copy.createdAt = new Date().toISOString();
    delete copy._shareId;
    saveMediaToDB(copy);
    $scope.currentUser.portfolios.push(copy);
    persistCurrentUser();
    $scope.showToast('Portfolio duplicated!', 'success');
  };

  /* ════════════════════════════════════════
     STATS & HELPERS
  ════════════════════════════════════════ */
  $scope.profileScore = function (p) {
    if (!p) return 0;
    var checks = [
      !!p.name,
      !!p.role,
      !!(p.bio && p.bio.length > 30),
      !!p.location,
      !!p.avatarImg,
      !!(p.skills && p.skills.length >= 3),
      !!(p.projects && p.projects.length >= 1),
      !!(p.projects && p.projects.length >= 2),
      !!p.email,
      !!(p.github || p.linkedin)
    ];
    return Math.round(checks.filter(Boolean).length / checks.length * 100);
  };

  $scope.scoreLabel = function (s) {
    if (s >= 90) return '🏆 Excellent';
    if (s >= 70) return '⭐ Good';
    if (s >= 40) return '📈 Building';
    return '🌱 Just Started';
  };

  $scope.totalProjects = function () {
    return ($scope.currentUser && $scope.currentUser.portfolios || [])
      .reduce(function (a, p) { return a + ((p.projects && p.projects.length) || 0); }, 0);
  };

  $scope.totalSkills = function () {
    var all = [];
    ($scope.currentUser && $scope.currentUser.portfolios || []).forEach(function (p) {
      (p.skills || []).forEach(function (s) {
        if (all.indexOf(s.toLowerCase()) === -1) all.push(s.toLowerCase());
      });
    });
    return all.length;
  };

  $scope.filteredPortfolios = function () {
    var list = ($scope.currentUser && $scope.currentUser.portfolios) || [];
    var q = ($scope.dashSearch || '').toLowerCase();
    if (!q) return list;
    return list.filter(function (p) {
      return (p.name || '').toLowerCase().indexOf(q) !== -1 ||
             (p.role || '').toLowerCase().indexOf(q) !== -1;
    });
  };

  $scope.bioWordCount = function (bio) {
    if (!bio || !bio.trim()) return 0;
    return bio.trim().split(/\s+/).length;
  };

  /* ════════════════════════════════════════
     PROJECTS
  ════════════════════════════════════════ */
  $scope.addProject = function () {
    var p = $scope.newProject;
    if (!p.title || !p.title.trim()) { $scope.showToast('Project needs a name.', 'error'); return; }
    if (!$scope.editingPortfolio.projects) $scope.editingPortfolio.projects = [];
    $scope.editingPortfolio.projects.push({
      title:  p.title.trim(),
      desc:   (p.desc   || '').trim(),
      stack:  (p.stack  || '').trim(),
      url:    (p.url    || '').trim(),
      github: (p.github || '').trim(),
      image:  p.image   || null,
      video:  p.video   || null
    });
    $scope.newProject = {};
    $scope.showToast('Project added!', 'success');
  };

  $scope.removeProject = function (idx) {
    $scope.editingPortfolio.projects.splice(idx, 1);
  };

  $scope.moveProject = function (idx, dir) {
    var arr = $scope.editingPortfolio.projects;
    var to  = idx + dir;
    if (to < 0 || to >= arr.length) return;
    var tmp = arr[idx]; arr[idx] = arr[to]; arr[to] = tmp;
  };

  $scope.openProjectPopup = function (proj) {
    $scope.activeProject = proj;
    $scope.modal         = 'projectPopup';
  };

  $scope.trustedVideoSrc = function (src) {
    return $sce.trustAsResourceUrl(src || '');
  };

  /* ════════════════════════════════════════
     FILE UPLOADS
  ════════════════════════════════════════ */
  function readFile (file, maxMB, cb) {
    if (!file) return;
    if (file.size > maxMB * 1024 * 1024) {
      $scope.$apply(function () {
        $scope.showToast('File too large (max ' + maxMB + 'MB).', 'error');
      });
      return;
    }
    var r = new FileReader();
    r.onload = function (e) { cb(e.target.result); };
    r.readAsDataURL(file);
  }

  $scope.onAvatarUpload = function (evt) {
    var f = evt.target.files[0]; if (!f) return;
    readFile(f, 3, function (d) {
      $scope.$apply(function () { $scope.editingPortfolio.avatarImg = d; });
    });
    evt.target.value = '';
  };

  $scope.onProjectMediaUpload = function (evt) {
    var f = evt.target.files[0]; if (!f) return;
    var isVid = f.type.indexOf('video/') === 0;
    readFile(f, isVid ? 80 : 3, function (d) {
      $scope.$apply(function () {
        if (isVid) { $scope.newProject.video = d; $scope.newProject.image = null; }
        else       { $scope.newProject.image = d; $scope.newProject.video = null; }
      });
    });
    evt.target.value = '';
  };

  /* ════════════════════════════════════════
     SHARE LINKS  (short ID system)
  ════════════════════════════════════════ */
  function getShares () {
    try { return JSON.parse(localStorage.getItem(SHARES_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function saveShares (s) {
    try { localStorage.setItem(SHARES_KEY, JSON.stringify(s)); } catch (e) {}
  }

  function buildShareUrl (portfolio) {
    var sid = portfolio._shareId || genId();
    portfolio._shareId = sid;
    var shareable = angular.copy(portfolio);
    // Strip videos from share payload (too large for localStorage)
    (shareable.projects || []).forEach(function (pr) { pr.video = null; });
    var shares = getShares();
    shares[sid] = JSON.stringify(shareable);
    saveShares(shares);
    return $window.location.href.split('#')[0] + '#p=' + sid;
  }

  $scope.openShareModal = function (idx) {
    var p = $scope.currentUser.portfolios[idx];
    $scope.shareTarget = p;
    $scope.shareUrl    = buildShareUrl(p);
    $scope.modal       = 'share';
  };

  $scope.openShareModalFromEditor = function () {
    var p = $scope.editingPortfolio;
    if (!p.name || !p.name.trim()) { $scope.showToast('Add a title first.', 'error'); return; }
    $scope.shareTarget = p;
    $scope.shareUrl    = buildShareUrl(p);
    $scope.modal       = 'share';
  };

  $scope.copyShareLink = function () {
    if (!$scope.shareUrl) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText($scope.shareUrl).then(function () {
        $scope.$apply(function () { $scope.showToast('Link copied! 📋', 'success'); });
      });
    } else {
      var ta = document.createElement('textarea');
      ta.value = $scope.shareUrl;
      document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      $scope.showToast('Link copied! 📋', 'success');
    }
  };

  $scope.openShareLink = function () {
    if ($scope.shareUrl) $window.open($scope.shareUrl, '_blank');
  };

  /* ════════════════════════════════════════
     VIEW COUNTER
  ════════════════════════════════════════ */
  function getViews () {
    try { return JSON.parse(localStorage.getItem(VIEWS_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function bumpView (shareId) {
    var v = getViews();
    v[shareId] = (v[shareId] || 0) + 1;
    try { localStorage.setItem(VIEWS_KEY, JSON.stringify(v)); } catch (e) {}
  }
  $scope.getViewCount = function (p) {
    if (!p || !p._shareId) return 0;
    return getViews()[p._shareId] || 0;
  };

  /* ════════════════════════════════════════
     PREVIEW THEME TOGGLE
  ════════════════════════════════════════ */
  $scope.togglePreviewTheme = function () {
    $scope.previewLight = !$scope.previewLight;
  };

}]);