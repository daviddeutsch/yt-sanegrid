(function () {

	angular.module('googleAPI', []);


	function GoogleApiProvider () {
		var self = this;

		this.clientId = '950592637430.apps.googleusercontent.com';

		this.apiKey = 'AIzaSyCs378KoxX1cX5_TTa5W65tTG396AkId0A';

		this.scopes = 'https://www.googleapis.com/auth/youtube';

		this.gapi = gapi;

		this.q = {};

		this.connect = function()
		{
			var deferred = self.q.defer();

			this.gapi.auth.authorize(
				{
					client_id: this.clientId,
					scope: this.scopes,
					immediate: false
				},
				function( result ) {
					if ( result && !result.error ) {
						self.gapi.client.load('youtube', 'v3', function(response) {
							deferred.resolve(response);
						});
					} else {
						deferred.reject();
					}
				}
			);

			return deferred.promise;
		};

		this.checkAuth = function() {
			return this.connect();
		};

		this.authorize = function() {
			return this.connect();
		};

		this.load = function() {
			this.gapi.load();

			this.gapi.client.setApiKey(this.apiKey);
		};

		this.$get = [
			'$q',
			function ( $q )
			{
				var provider = new GoogleApiProvider();

				provider.q = $q;

				return provider;
			}
		];
	}

	angular.module('googleAPI').provider('googleApi', GoogleApiProvider);

})();
