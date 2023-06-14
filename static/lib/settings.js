'use strict';

define('forum/account/2factor', ['translator', 'benchpress', 'api', 'alerts', 'bootbox'], function (translator, bch, api, alerts, bootbox) {
	var Settings = {};

	Settings.init = function () {
		document.querySelector('#content .list-group').addEventListener('click', (e) => {
			if (!e.target.closest('[data-action]') || Array.from(e.target.classList).includes('text-muted')) {
				return;
			}

			const action = e.target.getAttribute('data-action');
			Settings[action].call(e.target);
		});
	};

	Settings.setupTotp = function () {
		socket.emit('plugins.2factor.regenerate', async (err, data) => {
			if (err) {
				return alerts.error(err);
			}

			const html = await bch.render('partials/2factor/generate', data);
			const [message, title] = await Promise.all([
				translator.translate(html),
				translator.translate('[[2factor:generate.title]]'),
			]);
			const size = 'lg';

			var modal = bootbox.dialog({ title, message, size });
			var formEl = modal.find('form');
			var confirmEl = modal.find('button[data-action="confirm"]');
			var codeEl = modal.find('.2fa-confirm');

			confirmEl.on('click', function () {
				Settings.verifyTotp(data.key, codeEl.val(), modal);
			});

			formEl.on('submit', function (e) {
				e.preventDefault();
				Settings.verifyTotp(data.key, codeEl.val(), modal);
			});

			modal.on('shown.bs.modal', function () {
				codeEl.focus();
			});
		});
	};

	Settings.disableTotp = () => {
		translator.translate('[[2factor:user.manage.disableTotp]]', function (disableText) {
			bootbox.confirm(disableText, function (confirm) {
				if (confirm) {
					api.del('/plugins/2factor/totp').then(ajaxify.refresh).catch(alerts.error);
				}
			});
		});
	};

	Settings.disableAuthn = () => {
		translator.translate('[[2factor:user.manage.disableAuthn]]', function (disableText) {
			bootbox.confirm(disableText, function (confirm) {
				if (confirm) {
					api.del('/plugins/2factor/authn').then(ajaxify.refresh).catch(alerts.error);
				}
			});
		});
	};

	Settings.setupAuthn = function () {
		const self = this;
		self.classList.add('text-muted');
		const modal = bootbox.dialog({
			message: '[[2factor:authn.modal.content]]',
			closeButton: false,
			className: 'text-center',
		});
		api.get('/plugins/2factor/authn/register', {}).then(async (request) => {
			try {
				const webauthnJSON = await import('@github/webauthn-json');
				const response = await webauthnJSON.create({
					publicKey: request,
				});
				modal.modal('hide');

				api.post('/plugins/2factor/authn/register', response).then(() => {
					alerts.success('[[2factor:authn.success]]');
					setTimeout(document.location.reload.bind(document.location), 1000);
				}).catch(alerts.error);
			} catch (e) {
				modal.modal('hide');
				self.classList.remove('disabled');
				alerts.alert({
					message: '[[2factor:authn.error]]',
					timeout: 2500,
				});
			}
		});
	};

	Settings.verifyTotp = function (key, token, modal) {
		socket.emit('plugins.2factor.confirm', {
			key: key,
			token: token,
		}, function (err) {
			if (!err) {
				modal.modal('hide');
				ajaxify.refresh();
				translator.translate('[[2factor:generate.success]]', function (successText) {
					alerts.success(successText);
				});
			} else {
				// Probably a bad validation code
				var inputEl = modal.find('.2fa-confirm');
				inputEl.parent().addClass('has-error');
			}
		});
	};

	Settings.generateBackupCodes = function () {
		$.ajax(config.relative_path + '/login/2fa/backup', {
			method: 'put',
			headers: {
				'x-csrf-token': config.csrf_token,
			},
		}).done(function (data) {
			bch.parse('partials/2factor/generateBackupCodes', data, function (html) {
				translator.translate(html, function (translatedHTML) {
					translator.translate('[[2factor:backup.generate.title]]', function (title) {
						bootbox.dialog({
							title: title,
							message: translatedHTML,
							onEscape: true,
						});
					});
				});
			});
		});
	};

	return Settings;
});
